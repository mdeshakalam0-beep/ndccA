import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useToast } from '../components/ui/Toast';
import { 
  ClipboardList, 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  GraduationCap, 
  BookOpen
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Dialog from '../components/ui/Dialog';
import Skeleton from '../components/ui/Skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';

const homeworkSchema = zod.object({
  title: zod.string().min(2, 'Title must be at least 2 characters'),
  description: zod.string().min(5, 'Description must be at least 5 characters'),
  classId: zod.string().min(1, 'Please select a class standard'),
  subjectId: zod.string().min(1, 'Please select a subject'),
  deadlineDate: zod.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Deadline must be in YYYY-MM-DD format'),
});

type HomeworkFormValues = zod.infer<typeof homeworkSchema>;

export const Homework: React.FC = () => {
  const toast = useToast();
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [selectedFilterClass, setSelectedFilterClass] = useState('all');

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [homeworkToDelete, setHomeworkToDelete] = useState<any | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<HomeworkFormValues>({
    resolver: zodResolver(homeworkSchema),
    defaultValues: {
      title: '',
      description: '',
      classId: '',
      subjectId: '',
      deadlineDate: new Date(Date.now() + 86400000).toISOString().split('T')[0] // default to tomorrow
    }
  });

  const watchedClassId = watch('classId');

  // Listen to Firestore classes list sorted by displayOrder ASC
  useEffect(() => {
    const q = query(collection(db, 'classes'), orderBy('displayOrder', 'asc'));
    const unsubClasses = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setClassesList(list);
    }, (err) => {
      console.error("Error loading classes:", err);
    });
    return () => unsubClasses();
  }, []);

  // Listen to subjects
  useEffect(() => {
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setSubjects(list);
    });
    return () => unsubSubjects();
  }, []);

  // Listen to homework collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'homework'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by creation date descending (latest first)
      setHomeworkList(list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync homework records.');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Form options for classes (includes "All Classes")
  const homeworkFormClassOptions = useMemo(() => {
    const active = classesList.filter((c) => c.isActive);
    const options = [
      { value: 'all', label: 'All Classes' },
      ...active.map((c) => ({ value: c.id, label: c.className }))
    ];

    // If editing homework linked to an inactive class, keep it in the dropdown options
    if (editingHomework && editingHomework.classId && editingHomework.classId !== 'all') {
      const isCurrentActive = active.some((c) => c.id === editingHomework.classId);
      if (!isCurrentActive) {
        const inactiveLinkedClass = classesList.find((c) => c.id === editingHomework.classId);
        if (inactiveLinkedClass) {
          options.push({
            value: inactiveLinkedClass.id,
            label: `${inactiveLinkedClass.className} (Disabled)`
          });
        }
      }
    }
    
    return options;
  }, [classesList, editingHomework]);

  // Dynamically filter subjects matching the currently selected classId (or public "all" subjects)
  const filteredSubjects = useMemo(() => {
    if (!watchedClassId) return [];
    
    const list = subjects.filter(
      (sub) => sub.classId === watchedClassId || sub.classId === 'all'
    );

    // If editing and the linked subject isn't present (e.g. inactive or different class), load it
    if (editingHomework && editingHomework.subjectId && editingHomework.classId === watchedClassId) {
      const hasSubject = list.some((sub) => sub.id === editingHomework.subjectId);
      if (!hasSubject) {
        const linkedSubject = subjects.find((sub) => sub.id === editingHomework.subjectId);
        if (linkedSubject) {
          list.push(linkedSubject);
        }
      }
    }

    return list;
  }, [subjects, watchedClassId, editingHomework]);

  // Combined unique values for filtering the homework grid on top
  const filterClassOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Classes' }];
    
    // Add configured classes
    classesList.forEach((c) => {
      options.push({ value: c.id, label: `Class ${c.className}` });
    });
    
    return options;
  }, [classesList]);

  // Filtered list displayed
  const filteredHomeworkList = useMemo(() => {
    return homeworkList.filter((hw) => {
      return selectedFilterClass === 'all' || hw.classId === selectedFilterClass;
    });
  }, [homeworkList, selectedFilterClass]);

  const handleCreateClick = () => {
    setEditingHomework(null);
    reset({
      title: '',
      description: '',
      classId: '',
      subjectId: '',
      deadlineDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (hw: any) => {
    setEditingHomework(hw);
    reset({
      title: hw.title,
      description: hw.description,
      classId: hw.classId || '',
      subjectId: hw.subjectId || '',
      deadlineDate: hw.deadlineDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (data: HomeworkFormValues) => {
    // Load subject name metadata
    const sub = subjects.find(s => s.id === data.subjectId);
    const subjectName = sub ? sub.name : 'Unknown Subject';

    // Load class standard metadata
    let className = 'All Classes';
    if (data.classId !== 'all') {
      const selectedClassDoc = classesList.find((c) => c.id === data.classId);
      className = selectedClassDoc ? selectedClassDoc.className : 'Unassigned Class';
    }

    const payload = {
      title: data.title,
      description: data.description,
      classId: data.classId,
      className, // Save class name string
      subjectId: data.subjectId,
      subjectName,
      deadlineDate: data.deadlineDate,
      updatedAt: Timestamp.now()
    };

    try {
      if (editingHomework) {
        await updateDoc(doc(db, 'homework', editingHomework.id), payload);
        toast.success('Homework task saved successfully.');
      } else {
        const newPayload = {
          ...payload,
          createdAt: Timestamp.now(),
        };
        await addDoc(collection(db, 'homework'), newPayload);
        toast.success('New homework task added.');
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save homework record.');
    }
  };

  const handleDeleteClick = (hw: any) => {
    setHomeworkToDelete(hw);
    setIsDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!homeworkToDelete) return;
    try {
      await deleteDoc(doc(db, 'homework', homeworkToDelete.id));
      toast.success('Homework task deleted successfully.');
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete homework.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Homework</h1>
          <p className="text-sm text-muted-foreground">Assign and manage classroom homework tasks linked to academic classes.</p>
        </div>
        <Button onClick={handleCreateClick} className="cursor-pointer">
          <Plus className="h-4.5 w-4.5" />
          Assign Homework
        </Button>
      </div>

      {/* Filter Box */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Filter List by Class"
            options={filterClassOptions}
            value={selectedFilterClass}
            onChange={(e) => setSelectedFilterClass(e.target.value)}
          />
        </div>
      </div>

      {/* Homework List Container */}
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredHomeworkList.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground select-none">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-bold text-foreground">No homework assigned</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">Assign homework worksheets or lesson files to target classes.</p>
            <Button onClick={handleCreateClick} variant="outline" className="mt-4 cursor-pointer">
              <Plus className="h-4 w-4" /> Assign First Homework
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="py-4 px-6">Task Title</th>
                  <th className="py-4 px-6">Class</th>
                  <th className="py-4 px-6">Subject</th>
                  <th className="py-4 px-6">Deadline</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {filteredHomeworkList.map((hw) => (
                  <tr key={hw.id} className="hover:bg-secondary/20 transition-all">
                    <td className="py-3.5 px-6 font-semibold text-foreground">
                      <div className="flex flex-col text-left">
                        <span>{hw.title}</span>
                        <span className="text-[11px] text-muted-foreground font-normal line-clamp-1 mt-0.5">{hw.description}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground font-semibold">
                      <div className="flex items-center gap-1.5 text-primary">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        {hw.className || 'Unassigned'}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
                        {hw.subjectName}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-rose-500/70" />
                        {hw.deadlineDate}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-right select-none">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEditClick(hw)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all cursor-pointer"
                          title="Edit Task Details"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(hw)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                          title="Delete Homework"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Dialog Modal for Homework */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingHomework ? 'Modify Homework' : 'Assign Homework Task'}
        description="Configure target standard classes, subject links, and due date deadlines."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left select-none">
          <Input label="Homework Title" id="title" placeholder="e.g. Work and Energy Exercises" {...register('title')} error={errors.title?.message} />

          <div className="w-full flex flex-col gap-1.5">
            <label htmlFor="description" className="text-xs font-semibold tracking-wide text-foreground/80">
              Task Directions / Description
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="Provide worksheet questions, pages, or directions here..."
              className={`w-full bg-card text-sm p-3 rounded-lg border border-border outline-none transition-all placeholder:text-muted-foreground/50 resize-none focus:border-primary focus:ring-1 focus:ring-primary ${
                errors.description ? 'border-destructive focus:border-destructive focus:ring-destructive' : ''
              }`}
              {...register('description')}
            />
            {errors.description && (
              <span className="text-[11px] font-medium text-destructive leading-none">
                {errors.description.message}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Target Class Standard"
              id="classId"
              options={[
                { value: '', label: 'Select standard first' },
                ...homeworkFormClassOptions
              ]}
              {...register('classId')}
              error={errors.classId?.message}
            />

            <Select
              label="Subject Course"
              id="subjectId"
              options={[
                { value: '', label: watchedClassId ? 'Select subject' : 'First select a class standard' },
                ...filteredSubjects.map((sub) => ({ value: sub.id, label: sub.name }))
              ]}
              disabled={!watchedClassId}
              {...register('subjectId')}
              error={errors.subjectId?.message}
            />
          </div>

          <Input label="Submission Deadline Date" id="deadlineDate" type="date" {...register('deadlineDate')} error={errors.deadlineDate?.message} />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer">
              {editingHomework ? 'Save Changes' : 'Assign Homework'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Homework Confirmation"
        description="Are you sure you want to permanently delete this homework task? Students will immediately lose access."
        footerActions={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="cursor-pointer">
              Delete Task
            </Button>
          </>
        }
      >
        {homeworkToDelete && (
          <div className="bg-secondary/40 border border-border/40 rounded-xl p-3.5 text-left select-none">
            <p className="font-bold text-foreground leading-snug">{homeworkToDelete.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Subject: {homeworkToDelete.subjectName} • Deadline: {homeworkToDelete.deadlineDate}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Homework;

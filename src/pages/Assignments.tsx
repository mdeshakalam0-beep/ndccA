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
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  GraduationCap, 
  BookOpen, 
  XCircle 
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Dialog from '../components/ui/Dialog';
import Skeleton from '../components/ui/Skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';

const assignmentSchema = zod.object({
  title: zod.string().min(2, 'Title must be at least 2 characters'),
  topic: zod.string().min(2, 'Topic must be at least 2 characters'),
  classId: zod.string().min(1, 'Please select a class standard'),
  subjectId: zod.string().min(1, 'Please select a subject'),
  dueDate: zod.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
});

type AssignmentFormValues = zod.infer<typeof assignmentSchema>;

export const Assignments: React.FC = () => {
  const toast = useToast();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [selectedFilterClass, setSelectedFilterClass] = useState('all');

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<any | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: '',
      topic: '',
      classId: '',
      subjectId: '',
      dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0] // default to in 2 days
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

  // Listen to assignments collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'assignments'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by creation date descending (latest first)
      setAssignments(list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync assignments.');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Form options for classes (includes "All Classes")
  const assignmentFormClassOptions = useMemo(() => {
    const active = classesList.filter((c) => c.isActive);
    const options = [
      { value: 'all', label: 'All Classes' },
      ...active.map((c) => ({ value: c.id, label: c.className }))
    ];

    // If editing linked to an inactive class, keep it in the dropdown options
    if (editingAssignment && editingAssignment.classId && editingAssignment.classId !== 'all') {
      const isCurrentActive = active.some((c) => c.id === editingAssignment.classId);
      if (!isCurrentActive) {
        const inactiveLinkedClass = classesList.find((c) => c.id === editingAssignment.classId);
        if (inactiveLinkedClass) {
          options.push({
            value: inactiveLinkedClass.id,
            label: `${inactiveLinkedClass.className} (Disabled)`
          });
        }
      }
    }
    
    return options;
  }, [classesList, editingAssignment]);

  // Dynamically filter subjects matching the currently selected classId (or public "all" subjects)
  const filteredSubjects = useMemo(() => {
    if (!watchedClassId) return [];
    
    const list = subjects.filter(
      (sub) => sub.classId === watchedClassId || sub.classId === 'all'
    );

    // If editing and the linked subject isn't present (e.g. inactive or different class), load it
    if (editingAssignment && editingAssignment.subjectId && editingAssignment.classId === watchedClassId) {
      const hasSubject = list.some((sub) => sub.id === editingAssignment.subjectId);
      if (!hasSubject) {
        const linkedSubject = subjects.find((sub) => sub.id === editingAssignment.subjectId);
        if (linkedSubject) {
          list.push(linkedSubject);
        }
      }
    }

    return list;
  }, [subjects, watchedClassId, editingAssignment]);

  // Combined unique values for filtering assignments
  const filterClassOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Classes' }];
    
    // Add configured classes
    classesList.forEach((c) => {
      options.push({ value: c.id, label: `Class ${c.className}` });
    });
    
    return options;
  }, [classesList]);

  // Filtered list displayed
  const filteredAssignments = useMemo(() => {
    return assignments.filter((asg) => {
      return selectedFilterClass === 'all' || asg.classId === selectedFilterClass;
    });
  }, [assignments, selectedFilterClass]);

  const handleCreateClick = () => {
    setEditingAssignment(null);
    reset({
      title: '',
      topic: '',
      classId: '',
      subjectId: '',
      dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0]
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (asg: any) => {
    setEditingAssignment(asg);
    reset({
      title: asg.title,
      topic: asg.topic,
      classId: asg.classId || '',
      subjectId: asg.subjectId || '',
      dueDate: asg.dueDate || new Date(Date.now() + 172800000).toISOString().split('T')[0]
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (data: AssignmentFormValues) => {
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
      topic: data.topic,
      classId: data.classId,
      className, // Save class name string
      subjectId: data.subjectId,
      subjectName,
      dueDate: data.dueDate,
      updatedAt: Timestamp.now()
    };

    try {
      if (editingAssignment) {
        await updateDoc(doc(db, 'assignments', editingAssignment.id), payload);
        toast.success('Assignment details saved successfully.');
      } else {
        const newPayload = {
          ...payload,
          createdAt: Timestamp.now(),
        };
        await addDoc(collection(db, 'assignments'), newPayload);
        toast.success('New assignment task created.');
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save assignment record.');
    }
  };

  const handleDeleteClick = (asg: any) => {
    setAssignmentToDelete(asg);
    setIsDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!assignmentToDelete) return;
    try {
      await deleteDoc(doc(db, 'assignments', assignmentToDelete.id));
      toast.success('Assignment deleted successfully.');
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete assignment.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Assignments</h1>
          <p className="text-sm text-muted-foreground">Assign and track classroom assignments tasks linked to academic classes.</p>
        </div>
        <Button onClick={handleCreateClick} className="cursor-pointer">
          <Plus className="h-4.5 w-4.5" />
          Assign Task
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

      {/* Assignments List Container */}
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground select-none">
            <XCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-bold text-foreground">No assignments configured</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">Assign test projects or homework assignments to target classes.</p>
            <Button onClick={handleCreateClick} variant="outline" className="mt-4 cursor-pointer">
              <Plus className="h-4 w-4" /> Create First Assignment
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="py-4 px-6">Assignment Info</th>
                  <th className="py-4 px-6">Class</th>
                  <th className="py-4 px-6">Subject</th>
                  <th className="py-4 px-6">Due Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {filteredAssignments.map((asg) => (
                  <tr key={asg.id} className="hover:bg-secondary/20 transition-all">
                    <td className="py-3.5 px-6 font-semibold text-foreground">
                      <div className="flex flex-col text-left">
                        <span>{asg.title}</span>
                        <span className="text-[11px] text-muted-foreground font-normal line-clamp-1 mt-0.5">Topic: {asg.topic}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground font-semibold">
                      <div className="flex items-center gap-1.5 text-primary">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        {asg.className || 'Unassigned'}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
                        {asg.subjectName}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-rose-500/70" />
                        {asg.dueDate}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-right select-none">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEditClick(asg)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all cursor-pointer"
                          title="Edit Assignment Details"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(asg)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                          title="Delete Assignment"
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

      {/* Form Dialog Modal for Assignment */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingAssignment ? 'Modify Assignment Settings' : 'Assign Classroom Task'}
        description="Provide targeted standard classes, assignment topic details, and due date."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left select-none">
          <Input label="Assignment Title" id="title" placeholder="e.g. Modern Physics Term Project" {...register('title')} error={errors.title?.message} />
          <Input label="Assignment Topic" id="topic" placeholder="e.g. Photoelectric Effect and Einstein equations" {...register('topic')} error={errors.topic?.message} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Target Class Standard"
              id="classId"
              options={[
                { value: '', label: 'Select standard first' },
                ...assignmentFormClassOptions
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

          <Input label="Submission Due Date" id="dueDate" type="date" {...register('dueDate')} error={errors.dueDate?.message} />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer">
              {editingAssignment ? 'Save Changes' : 'Create Assignment'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Assignment Confirmation"
        description="Are you sure you want to permanently delete this assignment? Students will immediately lose access."
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
        {assignmentToDelete && (
          <div className="bg-secondary/40 border border-border/40 rounded-xl p-3.5 text-left select-none">
            <p className="font-bold text-foreground leading-snug">{assignmentToDelete.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Subject: {assignmentToDelete.subjectName} • Due: {assignmentToDelete.dueDate}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Assignments;

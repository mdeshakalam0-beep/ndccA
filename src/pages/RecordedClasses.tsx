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
  Play, 
  Plus, 
  Edit2, 
  Trash2, 
  GraduationCap, 
  BookOpen, 
  Link as LinkIcon
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Dialog from '../components/ui/Dialog';
import Skeleton from '../components/ui/Skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';

const recordedClassSchema = zod.object({
  title: zod.string().min(2, 'Title must be at least 2 characters'),
  description: zod.string().min(5, 'Description must be at least 5 characters'),
  videoUrl: zod.string().url('Invalid video link URL (must start with http/https)'),
  classId: zod.string().min(1, 'Please select a class standard'),
  subjectId: zod.string().min(1, 'Please select a subject'),
});

type RecordedClassFormValues = zod.infer<typeof recordedClassSchema>;

export const RecordedClasses: React.FC = () => {
  const toast = useToast();
  const [recordedClasses, setRecordedClasses] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [selectedFilterClass, setSelectedFilterClass] = useState('all');

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecordedClass, setEditingRecordedClass] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [recordedClassToDelete, setRecordedClassToDelete] = useState<any | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<RecordedClassFormValues>({
    resolver: zodResolver(recordedClassSchema),
    defaultValues: {
      title: '',
      description: '',
      videoUrl: '',
      classId: '',
      subjectId: '',
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

  // Listen to recordedClasses collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'recordedClasses'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by creation date descending (latest first)
      setRecordedClasses(list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync recorded video lectures list.');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Form options for classes (includes "All Classes")
  const recordedClassFormOptions = useMemo(() => {
    const active = classesList.filter((c) => c.isActive);
    const options = [
      { value: 'all', label: 'All Classes' },
      ...active.map((c) => ({ value: c.id, label: c.className }))
    ];

    // If editing linked to an inactive class, keep it in the dropdown options
    if (editingRecordedClass && editingRecordedClass.classId && editingRecordedClass.classId !== 'all') {
      const isCurrentActive = active.some((c) => c.id === editingRecordedClass.classId);
      if (!isCurrentActive) {
        const inactiveLinkedClass = classesList.find((c) => c.id === editingRecordedClass.classId);
        if (inactiveLinkedClass) {
          options.push({
            value: inactiveLinkedClass.id,
            label: `${inactiveLinkedClass.className} (Disabled)`
          });
        }
      }
    }
    
    return options;
  }, [classesList, editingRecordedClass]);

  // Dynamically filter subjects matching the currently selected classId (or public "all" subjects)
  const filteredSubjects = useMemo(() => {
    if (!watchedClassId) return [];
    
    const list = subjects.filter(
      (sub) => sub.classId === watchedClassId || sub.classId === 'all'
    );

    // If editing and the linked subject isn't present (e.g. inactive or different class), load it
    if (editingRecordedClass && editingRecordedClass.subjectId && editingRecordedClass.classId === watchedClassId) {
      const hasSubject = list.some((sub) => sub.id === editingRecordedClass.subjectId);
      if (!hasSubject) {
        const linkedSubject = subjects.find((sub) => sub.id === editingRecordedClass.subjectId);
        if (linkedSubject) {
          list.push(linkedSubject);
        }
      }
    }

    return list;
  }, [subjects, watchedClassId, editingRecordedClass]);

  // Combined unique values for filtering recorded videos
  const filterClassOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Classes' }];
    
    // Add configured classes
    classesList.forEach((c) => {
      options.push({ value: c.id, label: `Class ${c.className}` });
    });
    
    return options;
  }, [classesList]);

  // Filtered array list displayed
  const filteredRecordedClasses = useMemo(() => {
    return recordedClasses.filter((rc) => {
      return selectedFilterClass === 'all' || rc.classId === selectedFilterClass;
    });
  }, [recordedClasses, selectedFilterClass]);

  const handleCreateClick = () => {
    setEditingRecordedClass(null);
    reset({
      title: '',
      description: '',
      videoUrl: '',
      classId: '',
      subjectId: '',
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (rc: any) => {
    setEditingRecordedClass(rc);
    reset({
      title: rc.title,
      description: rc.description,
      videoUrl: rc.videoUrl || '',
      classId: rc.classId || '',
      subjectId: rc.subjectId || '',
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (data: RecordedClassFormValues) => {
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
      videoUrl: data.videoUrl,
      classId: data.classId,
      className, // Save class name string
      subjectId: data.subjectId,
      subjectName,
      updatedAt: Timestamp.now()
    };

    try {
      if (editingRecordedClass) {
        await updateDoc(doc(db, 'recordedClasses', editingRecordedClass.id), payload);
        toast.success('Recorded lecture details saved successfully.');
      } else {
        const newPayload = {
          ...payload,
          createdAt: Timestamp.now(),
        };
        await addDoc(collection(db, 'recordedClasses'), newPayload);
        toast.success('New recorded lecture uploaded.');
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save recorded lecture.');
    }
  };

  const handleDeleteClick = (rc: any) => {
    setRecordedClassToDelete(rc);
    setIsDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!recordedClassToDelete) return;
    try {
      await deleteDoc(doc(db, 'recordedClasses', recordedClassToDelete.id));
      toast.success('Recorded class deleted successfully.');
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete recorded class.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Recorded Classes</h1>
          <p className="text-sm text-muted-foreground">Manage video lectures database, organize classes, and add video links.</p>
        </div>
        <Button onClick={handleCreateClick} className="cursor-pointer">
          <Plus className="h-4.5 w-4.5" />
          Add Recorded Lecture
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

      {/* Video Lectures Grid Container */}
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredRecordedClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground select-none">
            <Play className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-bold text-foreground">No recorded lectures uploaded</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">Upload video lectures (YouTube/Vimeo links) for targeted class standards.</p>
            <Button onClick={handleCreateClick} variant="outline" className="mt-4 cursor-pointer">
              <Plus className="h-4 w-4" /> Add First Video
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="py-4 px-6">Lecture Title</th>
                  <th className="py-4 px-6">Class</th>
                  <th className="py-4 px-6">Subject</th>
                  <th className="py-4 px-6">Video Link</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {filteredRecordedClasses.map((rc) => (
                  <tr key={rc.id} className="hover:bg-secondary/20 transition-all">
                    <td className="py-3.5 px-6 font-semibold text-foreground">
                      <div className="flex flex-col text-left">
                        <span>{rc.title}</span>
                        <span className="text-[11px] text-muted-foreground font-normal line-clamp-1 mt-0.5">{rc.description}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground font-semibold">
                      <div className="flex items-center gap-1.5 text-primary">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        {rc.className || 'Unassigned'}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
                        {rc.subjectName}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-primary select-none">
                      <a
                        href={rc.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs py-1 px-2.5 bg-primary/10 rounded-md hover:underline font-semibold"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Open Video Lecture
                      </a>
                    </td>
                    <td className="py-3.5 px-6 text-right select-none">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEditClick(rc)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all cursor-pointer"
                          title="Edit Video Details"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(rc)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                          title="Delete Recorded Lecture"
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

      {/* Form Dialog Modal for Recorded Video */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingRecordedClass ? 'Modify Video Details' : 'Add Recorded Lecture'}
        description="Provide targeted standard classes, course subject, and video url linkages."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left select-none">
          <Input label="Video Title" id="title" placeholder="e.g. Newton's laws of motion lecture 01" {...register('title')} error={errors.title?.message} />

          <div className="w-full flex flex-col gap-1.5">
            <label htmlFor="description" className="text-xs font-semibold tracking-wide text-foreground/80">
              Video Description / Syllabus details
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="Provide lecture details, chapters covered, or worksheets link here..."
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

          <Input label="Video URL Link (e.g., YouTube/Vimeo link)" id="videoUrl" placeholder="https://www.youtube.com/watch?v=..." {...register('videoUrl')} error={errors.videoUrl?.message} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Target Class Standard"
              id="classId"
              options={[
                { value: '', label: 'Select standard first' },
                ...recordedClassFormOptions
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer">
              {editingRecordedClass ? 'Save Changes' : 'Create Video Entry'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Video Confirmation"
        description="Are you sure you want to permanently delete this video lecture? Students will immediately lose access."
        footerActions={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="cursor-pointer">
              Delete Video
            </Button>
          </>
        }
      >
        {recordedClassToDelete && (
          <div className="bg-secondary/40 border border-border/40 rounded-xl p-3.5 text-left select-none">
            <p className="font-bold text-foreground leading-snug">{recordedClassToDelete.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Subject: {recordedClassToDelete.subjectName} • Video: {recordedClassToDelete.videoUrl}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default RecordedClasses;

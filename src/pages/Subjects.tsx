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
import { uploadImage } from '../services/cloudinary';
import { useToast } from '../components/ui/Toast';
import { 
  BookOpen, 
  Plus, 
  Edit2, 
  Trash2, 
  Camera, 
  XCircle,
  Eye,
  EyeOff,
  GraduationCap
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Dialog from '../components/ui/Dialog';
import Skeleton from '../components/ui/Skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';

const subjectSchema = zod.object({
  name: zod.string().min(2, 'Name must be at least 2 characters'),
  classId: zod.string().min(1, 'Class standard is required'),
  enabled: zod.boolean(),
});

type SubjectFormValues = zod.infer<typeof subjectSchema>;

export const Subjects: React.FC = () => {
  const toast = useToast();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<any | null>(null);

  // Image Selection
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      enabled: true,
    }
  });

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

  // Listen to Firestore subjects
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subjects'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort alphabetically by name
      setSubjects(list.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync subjects list.');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Dynamic dropdown list options for subjects (hides inactive ones unless already linked)
  const subjectFormClassOptions = useMemo(() => {
    const active = classesList.filter((c) => c.isActive);
    
    // Add "All Classes" at the top
    const options = [
      { value: 'all', label: 'All Classes' },
      ...active.map((c) => ({ value: c.id, label: c.className }))
    ];

    // If editing a subject linked to an inactive class, keep it in the options
    if (editingSubject && editingSubject.classId && editingSubject.classId !== 'all') {
      const isCurrentActive = active.some((c) => c.id === editingSubject.classId);
      if (!isCurrentActive) {
        const inactiveLinkedClass = classesList.find((c) => c.id === editingSubject.classId);
        if (inactiveLinkedClass) {
          options.push({
            value: inactiveLinkedClass.id,
            label: `${inactiveLinkedClass.className} (Disabled)`
          });
        }
      }
    }
    
    return options;
  }, [classesList, editingSubject]);

  const handleCreateClick = () => {
    setEditingSubject(null);
    setImagePreview('');
    setImageFile(null);
    reset({
      name: '',
      classId: '',
      enabled: true,
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (subject: any) => {
    setEditingSubject(subject);
    setImagePreview(subject.imageUrl || '');
    setImageFile(null);
    setValue('name', subject.name);
    setValue('classId', subject.classId || 'all');
    setValue('enabled', subject.enabled ?? true);
    setIsFormOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Toggle enable state inline
  const handleToggleEnabled = async (subject: any) => {
    try {
      const nextState = !subject.enabled;
      await updateDoc(doc(db, 'subjects', subject.id), { enabled: nextState });
      toast.success(`${subject.name} is now ${nextState ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.');
    }
  };

  const onSubmit = async (data: SubjectFormValues) => {
    setUploading(true);
    let finalImageUrl = editingSubject?.imageUrl || '';

    try {
      if (imageFile) {
        finalImageUrl = await uploadImage(imageFile, 'subject-images');
      }

      // Load selected class metadata
      let className = 'All Classes';
      if (data.classId !== 'all') {
        const selectedClassDoc = classesList.find((c) => c.id === data.classId);
        className = selectedClassDoc ? selectedClassDoc.className : 'Unassigned Class';
      }

      const payload = {
        name: data.name,
        classId: data.classId,
        className: className, // Save selected class name string
        enabled: data.enabled,
        imageUrl: finalImageUrl,
      };

      if (editingSubject) {
        await updateDoc(doc(db, 'subjects', editingSubject.id), payload);
        toast.success('Subject details saved successfully.');
      } else {
        const newPayload = {
          ...payload,
          createdAt: Timestamp.now(),
        };
        await addDoc(collection(db, 'subjects'), newPayload);
        toast.success('New subject created successfully.');
      }

      setIsFormOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save subject data.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (subject: any) => {
    setSubjectToDelete(subject);
    setIsDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!subjectToDelete) return;
    try {
      await deleteDoc(doc(db, 'subjects', subjectToDelete.id));
      toast.success(`${subjectToDelete.name} has been deleted.`);
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete subject.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Subjects</h1>
          <p className="text-sm text-muted-foreground">Manage academic subjects, syllabus modules, and display settings.</p>
        </div>
        <Button onClick={handleCreateClick} className="cursor-pointer">
          <Plus className="h-4.5 w-4.5" />
          Create Subject
        </Button>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/60 rounded-2xl p-4.5 space-y-4">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-4.5 w-24" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-card border border-border/80 rounded-2xl p-12 text-center text-muted-foreground select-none">
          <XCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">No subjects created</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Get started by creating a subject file for coaching courses.</p>
          <Button onClick={handleCreateClick} variant="outline" className="mt-4 cursor-pointer">
            <Plus className="h-4 w-4" /> Create First Subject
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className={`bg-card border rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-all group ${
                subject.enabled ? 'border-border/80' : 'border-border/85 opacity-75'
              }`}
            >
              {/* Card Image */}
              <div className="h-40 w-full relative bg-secondary/30 select-none overflow-hidden border-b border-border/30">
                {subject.imageUrl ? (
                  <img
                    src={subject.imageUrl}
                    alt={subject.name}
                    className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                    <BookOpen className="h-12 w-12" />
                  </div>
                )}
                
                {/* Active Indicator overlay */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    subject.enabled
                      ? 'bg-emerald-500/90 text-white backdrop-blur-sm shadow-sm'
                      : 'bg-black/60 text-white backdrop-blur-sm shadow-sm'
                  }`}>
                    {subject.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1 shadow-sm uppercase tracking-wider">
                    <GraduationCap className="h-2.5 w-2.5" />
                    {subject.className || 'All Classes'}
                  </span>
                </div>
              </div>

              {/* Card Details */}
              <div className="p-4.5 flex-1 flex flex-col gap-4 text-left">
                <h3 className="font-bold text-base text-foreground leading-snug group-hover:text-primary transition-colors truncate">
                  {subject.name}
                </h3>
                
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/40 select-none">
                  {/* Status toggle */}
                  <button
                    onClick={() => handleToggleEnabled(subject)}
                    className={`text-xs font-semibold py-1.5 px-3 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                      subject.enabled
                        ? 'border-emerald-500/15 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10'
                        : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {subject.enabled ? (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        Online
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        Offline
                      </>
                    )}
                  </button>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditClick(subject)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all cursor-pointer"
                      title="Edit Subject"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(subject)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                      title="Delete Subject"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Form Modal Dialog */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingSubject ? 'Edit Subject Settings' : 'Create New Subject'}
        description={editingSubject ? 'Modify details of this active subject syllabus.' : 'Add a new subject to the active student curriculum.'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left select-none">
          
          {/* Banner picker placeholder */}
          <div className="flex flex-col items-center gap-2 py-3 border border-dashed border-border/80 rounded-xl bg-secondary/15 select-none">
            <div className="relative h-28 w-48 rounded-lg overflow-hidden border border-border bg-muted/50 flex items-center justify-center">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <BookOpen className="h-10 w-10 text-muted-foreground/30" />
              )}
              <label className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity">
                <Camera className="h-5 w-5 mr-1.5" />
                Upload Image
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            </div>
            <span className="text-[10px] text-muted-foreground">Recommend size: 600 x 400 (aspect 3:2)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Subject Name"
              id="name"
              placeholder="e.g. Physics, Chemistry"
              {...register('name')}
              error={errors.name?.message}
            />

            <Select
              label="Class Standard"
              id="classId"
              options={[
                { value: '', label: 'Select standard' },
                ...subjectFormClassOptions
              ]}
              {...register('classId')}
              error={errors.classId?.message}
            />
          </div>

          <div className="flex items-center gap-2.5 py-1.5">
            <input
              type="checkbox"
              id="enabled"
              className="h-4 w-4 accent-primary rounded cursor-pointer"
              {...register('enabled')}
            />
            <label htmlFor="enabled" className="text-xs font-semibold text-foreground/80 cursor-pointer select-none">
              Publish directly to students home page
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" isLoading={uploading} className="cursor-pointer">
              {editingSubject ? 'Save Changes' : 'Create Subject'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Subject Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Subject Confirmation"
        description="Are you sure you want to permanently delete this subject? Students will immediately lose access to all course files and linked objective tests."
        footerActions={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="cursor-pointer">
              Delete Subject
            </Button>
          </>
        }
      >
        {subjectToDelete && (
          <div className="bg-secondary/40 border border-border/40 rounded-xl p-3.5 flex items-center gap-3 select-none text-left">
            {subjectToDelete.imageUrl ? (
              <img src={subjectToDelete.imageUrl} alt="" className="h-12 w-18 rounded-md object-cover border" />
            ) : (
              <div className="h-12 w-18 bg-secondary/50 flex items-center justify-center border rounded-md">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-bold text-foreground leading-snug">{subjectToDelete.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Linked syllabus content will be affected.</p>
            </div>
          </div>
        )}
      </Dialog>

    </div>
  );
};

export default Subjects;

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
  Video, 
  Plus, 
  Edit2, 
  Trash2, 
  GraduationCap, 
  Play
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Dialog from '../components/ui/Dialog';
import Skeleton from '../components/ui/Skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';

// Extractor utility for YouTube ID (compatible with standard, live, shorts, embed, and shortened URLs)
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const liveClassSchema = zod.object({
  title: zod.string().min(2, 'Title must be at least 2 characters'),
  description: zod.string().min(5, 'Description must be at least 5 characters'),
  youtubeLiveUrl: zod.string().refine((val) => {
    return getYouTubeId(val) !== null;
  }, 'Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=... or https://youtube.com/live/...)'),
  classId: zod.string().min(1, 'Please select a target class standard'),
});

type LiveClassFormValues = zod.infer<typeof liveClassSchema>;

export const LiveClasses: React.FC = () => {
  const toast = useToast();
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [selectedFilterClass, setSelectedFilterClass] = useState('all');

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLiveClass, setEditingLiveClass] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [liveClassToDelete, setLiveClassToDelete] = useState<any | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<LiveClassFormValues>({
    resolver: zodResolver(liveClassSchema),
    defaultValues: {
      title: '',
      description: '',
      youtubeLiveUrl: '',
      classId: '',
    }
  });

  const watchedLiveUrl = watch('youtubeLiveUrl');

  const previewYoutubeId = useMemo(() => {
    return getYouTubeId(watchedLiveUrl || '');
  }, [watchedLiveUrl]);

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

  // Listen to liveClasses collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'liveClasses'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by creation date descending
      setLiveClasses(list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync live class listings.');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Dropdown list options for targeting classes (includes "All Classes")
  const liveClassFormOptions = useMemo(() => {
    const active = classesList.filter((c) => c.isActive);
    const options = [
      { value: 'all', label: 'All Classes' },
      ...active.map((c) => ({ value: c.id, label: c.className }))
    ];

    // If editing linked to an inactive class, keep it in the dropdown options
    if (editingLiveClass && editingLiveClass.classId && editingLiveClass.classId !== 'all') {
      const isCurrentActive = active.some((c) => c.id === editingLiveClass.classId);
      if (!isCurrentActive) {
        const inactiveLinkedClass = classesList.find((c) => c.id === editingLiveClass.classId);
        if (inactiveLinkedClass) {
          options.push({
            value: inactiveLinkedClass.id,
            label: `${inactiveLinkedClass.className} (Disabled)`
          });
        }
      }
    }
    
    return options;
  }, [classesList, editingLiveClass]);

  // Filtering select box on top
  const filterClassOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Classes' }];
    
    // Add configured classes
    classesList.forEach((c) => {
      options.push({ value: c.id, label: `Class ${c.className}` });
    });
    
    return options;
  }, [classesList]);

  // Filtered array list
  const filteredLiveClasses = useMemo(() => {
    return liveClasses.filter((lc) => {
      return selectedFilterClass === 'all' || lc.classId === selectedFilterClass;
    });
  }, [liveClasses, selectedFilterClass]);

  const handleCreateClick = () => {
    setEditingLiveClass(null);
    reset({
      title: '',
      description: '',
      youtubeLiveUrl: '',
      classId: '',
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (lc: any) => {
    setEditingLiveClass(lc);
    reset({
      title: lc.title,
      description: lc.description || '',
      youtubeLiveUrl: lc.youtubeLiveUrl || '',
      classId: lc.classId || '',
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (data: LiveClassFormValues) => {
    // Load selected class metadata
    let className = 'All Classes';
    if (data.classId !== 'all') {
      const selectedClassDoc = classesList.find((c) => c.id === data.classId);
      className = selectedClassDoc ? selectedClassDoc.className : 'Unassigned Class';
    }

    const payload = {
      title: data.title,
      description: data.description,
      youtubeLiveUrl: data.youtubeLiveUrl,
      classId: data.classId,
      className, // Save class name string
      updatedAt: Timestamp.now()
    };

    try {
      if (editingLiveClass) {
        await updateDoc(doc(db, 'liveClasses', editingLiveClass.id), payload);
        toast.success('Live class saved successfully.');
      } else {
        const newPayload = {
          ...payload,
          createdAt: Timestamp.now(),
        };
        await addDoc(collection(db, 'liveClasses'), newPayload);
        toast.success('New YouTube live class scheduled.');
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save live class.');
    }
  };

  const handleDeleteClick = (lc: any) => {
    setLiveClassToDelete(lc);
    setIsDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!liveClassToDelete) return;
    try {
      await deleteDoc(doc(db, 'liveClasses', liveClassToDelete.id));
      toast.success('Live class session deleted successfully.');
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete live class.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Live Classes</h1>
          <p className="text-sm text-muted-foreground">Schedule and configure YouTube Live classes for targeted standards.</p>
        </div>
        <Button onClick={handleCreateClick} className="cursor-pointer">
          <Plus className="h-4.5 w-4.5" />
          Schedule Live Class
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

      {/* Live Sessions List Container */}
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredLiveClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground select-none">
            <Video className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-bold text-foreground">No live classes scheduled</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">Configure YouTube Live streams for targeted classes.</p>
            <Button onClick={handleCreateClick} variant="outline" className="mt-4 cursor-pointer">
              <Plus className="h-4 w-4" /> Schedule First Session
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="py-4 px-6">Class Title</th>
                  <th className="py-4 px-6">Class</th>
                  <th className="py-4 px-6">YouTube Live Stream</th>
                  <th className="py-4 px-6 text-center">Created At</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {filteredLiveClasses.map((lc) => (
                  <tr key={lc.id} className="hover:bg-secondary/20 transition-all">
                    <td className="py-3.5 px-6 font-semibold text-foreground text-left">
                      <div className="flex flex-col">
                        <span>{lc.title}</span>
                        <span className="text-[11px] font-normal text-muted-foreground line-clamp-1 mt-0.5">{lc.description}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground font-semibold">
                      <div className="flex items-center gap-1.5 text-primary">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        {lc.className || 'Unassigned'}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-primary select-none">
                      <a
                        href={lc.youtubeLiveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 bg-red-500/10 text-red-600 rounded-md hover:bg-red-500/15 font-semibold transition-all border border-red-500/10"
                      >
                        <Play className="h-3.5 w-3.5 shrink-0 fill-red-600" />
                        Watch Live Stream
                      </a>
                    </td>
                    <td className="py-3.5 px-6 text-center text-muted-foreground font-medium select-none">
                      {lc.createdAt ? new Date(lc.createdAt.toMillis()).toLocaleDateString([], { dateStyle: 'medium' }) : 'N/A'}
                    </td>
                    <td className="py-3.5 px-6 text-right select-none">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEditClick(lc)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all cursor-pointer"
                          title="Edit Session Details"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(lc)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                          title="Cancel Live Class"
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

      {/* Form Dialog Modal for Live Class */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingLiveClass ? 'Modify Live Class' : 'Schedule YouTube Live Session'}
        description="Provide targeted standard classes, streaming links, and descriptions."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left select-none">
          <Input label="Live Class Title" id="title" placeholder="e.g., Electric Dipole and Fields Lecture 02" {...register('title')} error={errors.title?.message} />

          <div className="w-full flex flex-col gap-1.5">
            <label htmlFor="description" className="text-xs font-semibold tracking-wide text-foreground/80">
              Live Stream Description
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="Provide live stream outline, details, or pre-requisite reading here..."
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
            <Input label="YouTube Live Stream URL" id="youtubeLiveUrl" placeholder="https://youtube.com/live/..." {...register('youtubeLiveUrl')} error={errors.youtubeLiveUrl?.message} />

            <Select
              label="Target Class Standard"
              id="classId"
              options={[
                { value: '', label: 'Select target standard' },
                ...liveClassFormOptions
              ]}
              {...register('classId')}
              error={errors.classId?.message}
            />
          </div>

          {/* Embedded YouTube Player Preview */}
          {previewYoutubeId && (
            <div className="space-y-2 mt-2 text-left">
              <span className="text-xs font-bold tracking-wide text-foreground/80">
                YouTube Live Embed Preview
              </span>
              <div className="aspect-video w-full rounded-xl overflow-hidden border border-border bg-slate-900 shadow-sm relative">
                <iframe
                  className="w-full h-full absolute inset-0"
                  src={`https://www.youtube.com/embed/${previewYoutubeId}`}
                  title="YouTube video player preview"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer">
              {editingLiveClass ? 'Save Changes' : 'Schedule Stream'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Cancel Session Confirmation"
        description="Are you sure you want to permanently delete this scheduled live class stream?"
        footerActions={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="cursor-pointer">
              Cancel Session
            </Button>
          </>
        }
      >
        {liveClassToDelete && (
          <div className="bg-secondary/40 border border-border/40 rounded-xl p-3.5 text-left select-none">
            <p className="font-bold text-foreground leading-snug">{liveClassToDelete.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Stream: {liveClassToDelete.youtubeLiveUrl}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default LiveClasses;

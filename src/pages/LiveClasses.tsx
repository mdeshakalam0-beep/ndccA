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
  Calendar, 
  Clock, 
  Link as LinkIcon, 
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

const liveClassSchema = zod.object({
  topic: zod.string().min(2, 'Topic must be at least 2 characters'),
  meetingUrl: zod.string().url('Invalid meeting URL (must start with http/https)'),
  classId: zod.string().min(1, 'Please select a target class standard'),
  date: zod.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: zod.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LiveClassFormValues>({
    resolver: zodResolver(liveClassSchema),
    defaultValues: {
      topic: '',
      meetingUrl: '',
      classId: '',
      date: new Date().toISOString().split('T')[0],
      time: '18:00'
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

  // Listen to liveClasses collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'liveClasses'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by date/time ascending (closest schedules first)
      setLiveClasses(list.sort((a, b) => {
        const timeA = `${a.date}T${a.time}`;
        const timeB = `${b.date}T${b.time}`;
        return timeA.localeCompare(timeB);
      }));
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
      topic: '',
      meetingUrl: '',
      classId: '',
      date: new Date().toISOString().split('T')[0],
      time: '18:00'
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (lc: any) => {
    setEditingLiveClass(lc);
    reset({
      topic: lc.topic,
      meetingUrl: lc.meetingUrl,
      classId: lc.classId || '',
      date: lc.date || new Date().toISOString().split('T')[0],
      time: lc.time || '18:00'
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
      topic: data.topic,
      meetingUrl: data.meetingUrl,
      classId: data.classId,
      className, // Save class name string
      date: data.date,
      time: data.time,
      updatedAt: Timestamp.now()
    };

    try {
      if (editingLiveClass) {
        await updateDoc(doc(db, 'liveClasses', editingLiveClass.id), payload);
        toast.success('Live class session saved successfully.');
      } else {
        const newPayload = {
          ...payload,
          createdAt: Timestamp.now(),
        };
        await addDoc(collection(db, 'liveClasses'), newPayload);
        toast.success('New live class session scheduled.');
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save live class scheduling.');
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
      toast.success('Live class session cancelled successfully.');
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
          <p className="text-sm text-muted-foreground">Schedule webinars, target standards, and distribute Zoom or Meet join links.</p>
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
            <p className="text-xs text-muted-foreground max-w-sm mt-1">Configure webinars or video lessons for targeted classes.</p>
            <Button onClick={handleCreateClick} variant="outline" className="mt-4 cursor-pointer">
              <Plus className="h-4 w-4" /> Schedule First Session
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="py-4 px-6">Class Topic</th>
                  <th className="py-4 px-6">Class</th>
                  <th className="py-4 px-6 text-center">Schedule Date & Time</th>
                  <th className="py-4 px-6">Platform Link</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {filteredLiveClasses.map((lc) => (
                  <tr key={lc.id} className="hover:bg-secondary/20 transition-all">
                    <td className="py-3.5 px-6 font-semibold text-foreground text-left">
                      {lc.topic}
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground font-semibold">
                      <div className="flex items-center gap-1.5 text-primary">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        {lc.className || 'Unassigned'}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-center text-muted-foreground font-medium">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-rose-500/70" /> {lc.date}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock className="h-3 w-3 text-muted-foreground" /> {lc.time}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-primary select-none">
                      <a
                        href={lc.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs py-1 px-2.5 bg-primary/10 rounded-md hover:underline font-semibold"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Join Meeting Link
                      </a>
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
        title={editingLiveClass ? 'Modify Live Class' : 'Schedule Webinar Session'}
        description="Provide targeted standard classes, zoom/meet joining links, and scheduled timing."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left select-none">
          <Input label="Webinar Session Topic" id="topic" placeholder="e.g. Electric Dipole and Fields lecture" {...register('topic')} error={errors.topic?.message} />

          <Input label="Meeting Join Link (e.g. Zoom, Google Meet)" id="meetingUrl" placeholder="https://zoom.us/j/1234567" {...register('meetingUrl')} error={errors.meetingUrl?.message} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Target Class Standard"
              id="classId"
              options={[
                { value: '', label: 'Select standard first' },
                ...liveClassFormOptions
              ]}
              {...register('classId')}
              error={errors.classId?.message}
            />

            <Input label="Session Schedule Date" id="date" type="date" {...register('date')} error={errors.date?.message} />
          </div>

          <Input label="Session Schedule Time" id="time" type="time" {...register('time')} error={errors.time?.message} />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer">
              {editingLiveClass ? 'Save Changes' : 'Schedule Session'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Cancel Session Confirmation"
        description="Are you sure you want to permanently cancel this scheduled live class? It will disappear from students timetables."
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
            <p className="font-bold text-foreground leading-snug">{liveClassToDelete.topic}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Date: {liveClassToDelete.date} • Time: {liveClassToDelete.time}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default LiveClasses;

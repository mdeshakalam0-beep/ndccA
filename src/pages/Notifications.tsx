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
  AlertOctagon, 
  AlertTriangle, 
  Info,
  XCircle,
  Clock,
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

const notificationSchema = zod.object({
  title: zod.string().min(2, 'Title must be at least 2 characters'),
  message: zod.string().min(5, 'Message must be at least 5 characters'),
  classId: zod.string().min(1, 'Please select a target class'),
  priority: zod.enum(['normal', 'important', 'emergency']),
});

type NotificationFormValues = zod.infer<typeof notificationSchema>;

export const Notifications: React.FC = () => {
  const toast = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<any | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      priority: 'normal',
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

  // Listen to Firestore notifications collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'notifications'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by creation date descending (latest first)
      setNotifications(list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync notifications.');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Dropdown list options for targeting notifications (hides inactive ones unless already linked)
  const notificationFormClassOptions = useMemo(() => {
    const active = classesList.filter((c) => c.isActive);
    const options = [
      { value: 'all', label: 'All Classes' },
      ...active.map((c) => ({ value: c.id, label: c.className }))
    ];

    // If editing a notification linked to an inactive class, keep it in the dropdown options
    if (editingNotification && editingNotification.classId && editingNotification.classId !== 'all') {
      const isCurrentActive = active.some((c) => c.id === editingNotification.classId);
      if (!isCurrentActive) {
        const inactiveLinkedClass = classesList.find((c) => c.id === editingNotification.classId);
        if (inactiveLinkedClass) {
          options.push({
            value: inactiveLinkedClass.id,
            label: `${inactiveLinkedClass.className} (Disabled)`
          });
        }
      }
    }
    
    return options;
  }, [classesList, editingNotification]);

  const handleCreateClick = () => {
    setEditingNotification(null);
    reset({
      title: '',
      message: '',
      classId: '',
      priority: 'normal',
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (notif: any) => {
    setEditingNotification(notif);
    reset({
      title: notif.title,
      message: notif.message,
      classId: notif.classId || 'all',
      priority: notif.priority || 'normal',
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (data: NotificationFormValues) => {
    // Load selected class metadata
    let className = 'All Classes';
    if (data.classId !== 'all') {
      const selectedClassDoc = classesList.find((c) => c.id === data.classId);
      className = selectedClassDoc ? selectedClassDoc.className : 'Unassigned Class';
    }

    const payload = {
      title: data.title,
      message: data.message,
      classId: data.classId,
      className, // Save class name string
      priority: data.priority,
    };

    try {
      if (editingNotification) {
        await updateDoc(doc(db, 'notifications', editingNotification.id), payload);
        toast.success('Notification updated successfully.');
      } else {
        const newPayload = {
          ...payload,
          createdAt: Timestamp.now(),
        };
        await addDoc(collection(db, 'notifications'), newPayload);
        toast.success('Notification broadcasted successfully.');
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save notification.');
    }
  };

  const handleDeleteClick = (notif: any) => {
    setNotificationToDelete(notif);
    setIsDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!notificationToDelete) return;
    try {
      await deleteDoc(doc(db, 'notifications', notificationToDelete.id));
      toast.success('Notification deleted successfully.');
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete notification.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Notifications Broadcast</h1>
          <p className="text-sm text-muted-foreground">Send real-time alerts and announcements directly to student mobile applications.</p>
        </div>
        <Button onClick={handleCreateClick} className="cursor-pointer">
          <Plus className="h-4.5 w-4.5" />
          New Notification
        </Button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-card border border-border/80 rounded-2xl p-12 text-center text-muted-foreground select-none">
          <XCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">No notifications sent</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Broadcast information alerts, class timing changes, or testing dates.</p>
          <Button onClick={handleCreateClick} variant="outline" className="mt-4 cursor-pointer">
            <Plus className="h-4 w-4" /> Send First Notification
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`bg-card border rounded-2xl p-5 shadow-sm flex gap-4 text-left transition-all ${
                notif.priority === 'emergency' ? 'border-rose-500/25 bg-rose-500/5' :
                notif.priority === 'important' ? 'border-amber-500/20 bg-amber-500/5' :
                'border-border/80'
              }`}
            >
              {/* Left Column: Icon Badge based on priority */}
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                notif.priority === 'emergency' ? 'bg-rose-500/10 text-rose-600' :
                notif.priority === 'important' ? 'bg-amber-500/15 text-amber-600' :
                'bg-blue-500/10 text-blue-600'
              }`}>
                {notif.priority === 'emergency' && <AlertOctagon className="h-5 w-5" />}
                {notif.priority === 'important' && <AlertTriangle className="h-5 w-5" />}
                {notif.priority === 'normal' && <Info className="h-5 w-5" />}
              </div>

              {/* Middle Column: Details */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 select-none">
                  <h3 className="text-base font-bold text-foreground truncate">{notif.title}</h3>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    notif.priority === 'emergency' ? 'bg-rose-500 text-white' :
                    notif.priority === 'important' ? 'bg-amber-500 text-black' :
                    'bg-blue-500 text-white'
                  }`}>
                    {notif.priority}
                  </span>
                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1 shadow-sm uppercase tracking-wider">
                    <GraduationCap className="h-2.5 w-2.5" />
                    Target: {notif.className || 'All Classes'}
                  </span>
                </div>
                
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {notif.message}
                </p>

                <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5 pt-1.5 select-none">
                  <Clock className="h-3 w-3" />
                  {notif.createdAt ? new Date(notif.createdAt.toMillis()).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                </p>
              </div>

              {/* Right Column: Edit/Delete buttons */}
              <div className="flex flex-col gap-1 shrink-0 justify-start select-none">
                <button
                  onClick={() => handleEditClick(notif)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg cursor-pointer transition-all"
                  title="Edit Notification"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteClick(notif)}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-all"
                  title="Delete Notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Broadcast Form Dialog Modal */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingNotification ? 'Edit Broadcast Alert' : 'Create Broadcast Alert'}
        description={editingNotification ? 'Modify the contents of this sent broadcast alert.' : 'Broadcast a message that appears instantly on student home pages.'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left select-none">
          <Input
            label="Notification Title"
            id="title"
            placeholder="e.g. Schedule Change Alert"
            {...register('title')}
            error={errors.title?.message}
          />

          <div className="w-full flex flex-col gap-1.5 text-left">
            <label htmlFor="message" className="text-xs font-semibold tracking-wide text-foreground/80 select-none">
              Broadcast Message Content
            </label>
            <textarea
              id="message"
              rows={4}
              placeholder="Provide notification announcements or directions here..."
              className={`w-full bg-card text-sm p-3 rounded-lg border border-border outline-none transition-all placeholder:text-muted-foreground/50 resize-none focus:border-primary focus:ring-1 focus:ring-primary ${
                errors.message ? 'border-destructive focus:border-destructive focus:ring-destructive' : ''
              }`}
              {...register('message')}
            />
            {errors.message && (
              <span className="text-[11px] font-medium text-destructive leading-none select-none">
                {errors.message.message}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Target Class"
              id="classId"
              options={[
                { value: '', label: 'Select target class' },
                ...notificationFormClassOptions
              ]}
              {...register('classId')}
              error={errors.classId?.message}
            />

            <Select
              label="Priority Tag Level"
              id="priority"
              options={[
                { value: 'normal', label: 'Normal (Standard Info)' },
                { value: 'important', label: 'Important (Class Updates)' },
                { value: 'emergency', label: 'Emergency (Urgent Alerts)' },
              ]}
              {...register('priority')}
              error={errors.priority?.message}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer">
              {editingNotification ? 'Save Changes' : 'Push Notification'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Confirm Notification Deletion"
        description="Are you sure you want to permanently delete this notification? Students will immediately lose access to this alert."
        footerActions={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="cursor-pointer">
              Delete Alert
            </Button>
          </>
        }
      >
        {notificationToDelete && (
          <div className="bg-secondary/40 border border-border/40 rounded-xl p-3.5 text-left select-none">
            <p className="font-bold text-foreground truncate">{notificationToDelete.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-sm truncate">{notificationToDelete.message}</p>
          </div>
        )}
      </Dialog>

    </div>
  );
};

export default Notifications;

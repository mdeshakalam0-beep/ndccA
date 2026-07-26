import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Dialog from '../components/ui/Dialog';
import { useToast } from '../components/ui/Toast';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  SlidersHorizontal
} from 'lucide-react';

interface ClassDoc {
  id: string;
  className: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const classSchema = zod.object({
  className: zod.string().min(1, 'Class name is required'),
  displayOrder: zod.number().min(1, 'Display order must be at least 1'),
  isActive: zod.boolean()
});

type ClassFormValues = zod.infer<typeof classSchema>;

export const Classes: React.FC = () => {
  const toast = useToast();
  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassDoc | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Delete confirm modal state
  const [deletingClass, setDeletingClass] = useState<ClassDoc | null>(null);
  const [checkingLink, setCheckingLink] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      className: '',
      displayOrder: 1,
      isActive: true
    }
  });

  // Real-time listener for classes ordered by displayOrder ASC
  useEffect(() => {
    const q = query(collection(db, 'classes'), orderBy('displayOrder', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ClassDoc[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ClassDoc);
      });
      setClasses(list);
      setLoading(false);
    }, (err) => {
      console.error("Error loading classes:", err);
      toast.error("Failed to load classes from database.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenAdd = () => {
    setEditingClass(null);
    reset({
      className: '',
      displayOrder: classes.length > 0 ? Math.max(...classes.map(c => c.displayOrder)) + 1 : 1,
      isActive: true
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (c: ClassDoc) => {
    setEditingClass(c);
    setValue('className', c.className);
    setValue('displayOrder', c.displayOrder);
    setValue('isActive', c.isActive);
    setOpenModal(true);
  };

  const onSubmit = async (data: ClassFormValues) => {
    setSaving(true);
    try {
      if (editingClass) {
        // Update class
        await updateDoc(doc(db, 'classes', editingClass.id), {
          className: data.className,
          displayOrder: data.displayOrder,
          isActive: data.isActive,
          updatedAt: Timestamp.now()
        });
        toast.success(`Class "${data.className}" updated successfully.`);
      } else {
        // Create class
        await addDoc(collection(db, 'classes'), {
          className: data.className,
          displayOrder: data.displayOrder,
          isActive: data.isActive,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        toast.success(`Class "${data.className}" created successfully.`);
      }
      setOpenModal(false);
    } catch (err: any) {
      console.error("Error saving class:", err);
      toast.error(err.message || "Failed to save class data.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (c: ClassDoc) => {
    try {
      await updateDoc(doc(db, 'classes', c.id), {
        isActive: !c.isActive,
        updatedAt: Timestamp.now()
      });
      toast.success(`Class "${c.className}" ${!c.isActive ? 'enabled' : 'disabled'} successfully.`);
    } catch (err: any) {
      console.error("Error toggling class status:", err);
      toast.error("Failed to update status.");
    }
  };

  // Perform checks across all related collections to block delete if linked
  const checkIsLinked = async (classId: string): Promise<boolean> => {
    const collectionsToCheck = [
      'students',
      'subjects',
      'objectiveTests',
      'homework',
      'assignments',
      'liveClasses',
      'recordedClasses'
    ];
    
    for (const colName of collectionsToCheck) {
      try {
        const q = query(collection(db, colName), where('classId', '==', classId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          console.log(`Class is linked to active document in collection: ${colName}`);
          return true;
        }
      } catch (err) {
        // If collection doesn't exist yet, it's safe to continue
        console.warn(`Collection ${colName} checked with warning:`, err);
      }
    }
    return false;
  };

  const handleDeleteClick = (c: ClassDoc) => {
    setDeletingClass(c);
  };

  const confirmDelete = async () => {
    if (!deletingClass) return;
    setCheckingLink(true);
    
    try {
      const isLinked = await checkIsLinked(deletingClass.id);
      
      if (isLinked) {
        toast.error(`Cannot delete class "${deletingClass.className}". It is linked to active records. Please disable it instead.`);
        setDeletingClass(null);
        return;
      }

      await deleteDoc(doc(db, 'classes', deletingClass.id));
      toast.success(`Class "${deletingClass.className}" deleted successfully.`);
      setDeletingClass(null);
    } catch (err: any) {
      console.error("Error deleting class:", err);
      toast.error("Failed to delete class.");
    } finally {
      setCheckingLink(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class Management</h1>
          <p className="text-muted-foreground text-sm">
            Add, edit, enable/disable, and organize educational class standards.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="flex items-center gap-2 cursor-pointer shadow-sm">
          <Plus className="h-4.5 w-4.5" />
          Add Standard Class
        </Button>
      </div>

      {/* Main List */}
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse">
            Loading classes directory...
          </div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center select-none">
            <SlidersHorizontal className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No Classes Configured</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Create academic standards (e.g., Class 6, Class 10) to organize your subjects and exams.
            </p>
            <Button onClick={handleOpenAdd} variant="outline" className="cursor-pointer">
              Add First Class
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="py-4 px-6 w-24">Order</th>
                  <th className="py-4 px-6">Class Standard Name</th>
                  <th className="py-4 px-6 w-36">Status</th>
                  <th className="py-4 px-6 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm">
                {classes.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-4 px-6 font-semibold text-muted-foreground">
                      {c.displayOrder}
                    </td>
                    <td className="py-4 px-6 font-bold text-foreground">
                      {c.className}
                    </td>
                    <td className="py-4 px-6 select-none">
                      <button
                        onClick={() => toggleStatus(c)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          c.isActive
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}
                        title="Click to toggle status"
                      >
                        {c.isActive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>{c.isActive ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right select-none">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground border border-border/40 cursor-pointer"
                          title="Edit Class Details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(c)}
                          className="h-8 w-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive border border-border/40 cursor-pointer animate-hover"
                          title="Delete Class"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Add / Edit Class Modal */}
      <Dialog
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
        title={editingClass ? 'Edit Class details' : 'Add Class standard'}
        description={editingClass ? 'Update details for this academic standard.' : 'Configure a new class for content assignments.'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1 select-none text-left">
          <Input
            label="Class Standard Name"
            id="className"
            placeholder="e.g. Class 10"
            {...register('className')}
            error={errors.className?.message}
          />

          <Input
            label="Display Sequence Order"
            id="displayOrder"
            type="number"
            placeholder="e.g. 10"
            {...register('displayOrder', { valueAsNumber: true })}
            error={errors.displayOrder?.message}
          />

          <div className="flex items-center justify-between border border-border/60 bg-secondary/20 p-3.5 rounded-xl mt-4">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Active Status</span>
              <span className="text-xs text-muted-foreground">Enable or disable standard selection</span>
            </div>
            <input
              type="checkbox"
              id="isActive"
              className="h-5 w-5 rounded border-border text-primary focus:ring-primary cursor-pointer"
              {...register('isActive')}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenModal(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} className="cursor-pointer">
              {editingClass ? 'Save Details' : 'Create Class'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={deletingClass !== null}
        onClose={() => setDeletingClass(null)}
        title="Verify Class Deletion"
        description="Are you sure you want to permanently delete this academic class?"
      >
        <div className="space-y-4 pt-1 select-none text-left">
          <div className="text-sm leading-relaxed text-muted-foreground">
            <p>
              Are you sure you want to permanently delete <span className="font-bold text-foreground">"{deletingClass?.className}"</span>?
            </p>
            <p className="text-xs border-l-2 border-amber-500 pl-3 py-1 bg-amber-500/5 rounded-r mt-3">
              <strong>Database Protection Rule:</strong> Deleting will fail if this class standard is linked to existing students, subjects, exams, or lesson resources. If it is linked, please de-activate (disable) it instead.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingClass(null)}
              className="cursor-pointer"
              disabled={checkingLink}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              isLoading={checkingLink}
              className="cursor-pointer"
            >
              Verify & Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Classes;

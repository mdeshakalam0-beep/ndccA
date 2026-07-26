import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp, 
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadImage } from '../services/cloudinary';
import { useToast } from '../components/ui/Toast';
import { 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Camera, 
  Eye, 
  EyeOff,
  Image as ImageIcon,
  XCircle,
  GraduationCap
} from 'lucide-react';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Skeleton from '../components/ui/Skeleton';
import Select from '../components/ui/Select';

export const HeroBanners: React.FC = () => {
  const toast = useToast();
  const [banners, setBanners] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState<any | null>(null);

  // File & Form states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('all');

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

  // Listen to banners collection in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'heroBanners'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by order ascending
      setBanners(list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync hero banners.');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Form options for class targeting (hides inactive ones)
  const bannerFormClassOptions = useMemo(() => {
    const active = classesList.filter((c) => c.isActive);
    return [
      { value: 'all', label: 'All Classes' },
      ...active.map((c) => ({ value: c.id, label: c.className }))
    ];
  }, [classesList]);

  const handleOpenUpload = () => {
    setImageFile(null);
    setImagePreview('');
    setSelectedClassId('all');
    setIsUploadOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      toast.error('Please select a banner image file.');
      return;
    }
    if (!selectedClassId) {
      toast.error('Please select a target class.');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload file to Cloudinary
      const finalUrl = await uploadImage(imageFile, 'hero-banners');

      // 2. Compute order index (append at the end)
      const maxOrder = banners.reduce((max, b) => Math.max(max, b.order || 0), -1);
      const nextOrder = maxOrder + 1;

      // 3. Load selected class name string
      let className = 'All Classes';
      if (selectedClassId !== 'all') {
        const selectedClassDoc = classesList.find((c) => c.id === selectedClassId);
        className = selectedClassDoc ? selectedClassDoc.className : 'Unassigned Class';
      }

      // 4. Create document in Firestore
      const newPayload = {
        imageUrl: finalUrl,
        classId: selectedClassId,
        className, // Save class name string
        order: nextOrder,
        enabled: true,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'heroBanners'), newPayload);
      toast.success('Hero banner uploaded and added to the slider.');
      setIsUploadOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload hero banner.');
    } finally {
      setUploading(false);
    }
  };

  // Toggle active/inactive state
  const handleToggleActive = async (banner: any) => {
    try {
      const nextState = !banner.enabled;
      await updateDoc(doc(db, 'heroBanners', banner.id), { enabled: nextState });
      toast.success(`Banner status updated successfully.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.');
    }
  };

  // Re-ordering logic: Swap order with adjacent item
  const handleShiftOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const currentBanner = banners[index];
    const targetBanner = banners[targetIndex];

    const currentOrder = currentBanner.order ?? index;
    const targetOrder = targetBanner.order ?? targetIndex;

    try {
      const batch = writeBatch(db);
      
      const currentRef = doc(db, 'heroBanners', currentBanner.id);
      const targetRef = doc(db, 'heroBanners', targetBanner.id);

      batch.update(currentRef, { order: targetOrder });
      batch.update(targetRef, { order: currentOrder });

      await batch.commit();
      toast.success('Banner sequence updated.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to reorder banners.');
    }
  };

  const handleDeleteClick = (banner: any) => {
    setBannerToDelete(banner);
    setIsDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!bannerToDelete) return;
    try {
      await deleteDoc(doc(db, 'heroBanners', bannerToDelete.id));
      toast.success('Hero banner deleted successfully.');
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete hero banner.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Hero Banners</h1>
          <p className="text-sm text-muted-foreground">Manage slider banners, sequence ordering, and display targets.</p>
        </div>
        <Button onClick={handleOpenUpload} className="cursor-pointer">
          <Plus className="h-4.5 w-4.5" />
          Upload Banner
        </Button>
      </div>

      {/* Main List Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/60 rounded-2xl p-4 space-y-4">
              <Skeleton className="h-44 w-full rounded-xl" />
              <div className="flex justify-between">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-card border border-border/80 rounded-2xl p-12 text-center text-muted-foreground select-none">
          <XCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">No hero banners</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Upload a landscape promotional image to display in the student app home slider.</p>
          <Button onClick={handleOpenUpload} variant="outline" className="mt-4 cursor-pointer">
            <Plus className="h-4 w-4" /> Upload First Banner
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`bg-card border rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-all group ${
                banner.enabled ? 'border-border/80' : 'border-border/85 opacity-70'
              }`}
            >
              {/* Aspect Ratio 16:9 Banner Image */}
              <div className="h-44 w-full relative bg-secondary/35 select-none overflow-hidden border-b border-border/30">
                {banner.imageUrl ? (
                  <img
                    src={banner.imageUrl}
                    alt=""
                    className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                    <ImageIcon className="h-12 w-12" />
                  </div>
                )}

                {/* Badges indicators */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-extrabold bg-primary text-white backdrop-blur-md px-2 py-0.5 rounded-full select-none shadow-sm">
                      Seq: {index + 1}
                    </span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm ${
                      banner.enabled
                        ? 'bg-emerald-500/90 text-white backdrop-blur-sm'
                        : 'bg-black/65 text-white backdrop-blur-sm'
                    }`}>
                      {banner.enabled ? 'Active' : 'Draft'}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-900/80 text-white backdrop-blur-sm flex items-center gap-1 shadow-sm uppercase tracking-wider">
                    <GraduationCap className="h-2.5 w-2.5" />
                    Target: {banner.className || 'All Classes'}
                  </span>
                </div>
              </div>

              {/* Banner Options */}
              <div className="p-4 flex items-center justify-between mt-auto select-none">
                {/* Re-ordering Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    disabled={index === 0}
                    onClick={() => handleShiftOrder(index, 'up')}
                    className="p-1.5 border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary cursor-pointer transition-all"
                    title="Move Up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    disabled={index === banners.length - 1}
                    onClick={() => handleShiftOrder(index, 'down')}
                    className="p-1.5 border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary cursor-pointer transition-all"
                    title="Move Down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {/* Activation and deletion buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(banner)}
                    className={`text-xs font-semibold py-1.5 px-3 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all ${
                      banner.enabled
                        ? 'border-emerald-500/15 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10'
                        : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {banner.enabled ? (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        Enabled
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        Disabled
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteClick(banner)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-all"
                    title="Delete Banner"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dialog Modal */}
      <Dialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Hero Banner"
        description="Select a banner image file to add to the student app home slider."
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4 text-left select-none">
          
          <div className="flex flex-col items-center gap-2 py-4 border border-dashed border-border/80 rounded-xl bg-secondary/15 select-none">
            <div className="relative h-32 w-56 rounded-lg overflow-hidden border border-border bg-muted/50 flex items-center justify-center">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
              )}
              <label className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity">
                <Camera className="h-5 w-5 mr-1.5" />
                Upload Image
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            </div>
            <span className="text-[10px] text-muted-foreground">Recommend size: 1200 x 600 (aspect 2:1)</span>
          </div>

          <Select
            label="Target Audience Class"
            id="classId"
            options={bannerFormClassOptions}
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" isLoading={uploading} className="cursor-pointer">
              Upload Banner
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Confirm Banner Deletion"
        description="Are you sure you want to permanently delete this banner? The change will instantly update the students homepage."
        footerActions={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="cursor-pointer">
              Delete Banner
            </Button>
          </>
        }
      >
        {bannerToDelete && (
          <div className="bg-secondary/40 border border-border/40 rounded-xl p-2.5 overflow-hidden select-none">
            <img src={bannerToDelete.imageUrl} alt="" className="h-28 w-full object-cover rounded-md border" />
          </div>
        )}
      </Dialog>

    </div>
  );
};

export default HeroBanners;

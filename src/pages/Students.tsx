import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  Timestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadImage } from '../services/cloudinary';
import { useToast } from '../components/ui/Toast';
import { 
  Search, 
  Download, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Eye, 
  Camera, 
  XCircle,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Dialog from '../components/ui/Dialog';
import Skeleton from '../components/ui/Skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';

const studentSchema = zod.object({
  name: zod.string().min(2, 'Name must be at least 2 characters'),
  fatherName: zod.string().min(2, 'Father name must be at least 2 characters'),
  classId: zod.string().min(1, 'Class is required'),
  dob: zod.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be in YYYY-MM-DD format'),
  gender: zod.enum(['Male', 'Female', 'Other']),
  village: zod.string().min(2, 'Village name must be at least 2 characters'),
  email: zod.string().email('Invalid email address'),
  status: zod.enum(['active', 'inactive']),
});

type StudentFormValues = zod.infer<typeof studentSchema>;

export const Students: React.FC = () => {
  const toast = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedVillage, setSelectedVillage] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
  
  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      gender: 'Male',
      status: 'active',
    }
  });

  // Listen to Firestore classes collection sorted by displayOrder ASC
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

  // Listen to Firestore students collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setStudents(list);
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync students list.');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Dropdown list options for student registration form (hides inactive ones unless already linked)
  const studentFormClassOptions = useMemo(() => {
    const active = classesList.filter((c) => c.isActive);
    
    // If editing a student linked to an inactive class, keep it in the dropdown options
    if (editingStudent && editingStudent.classId) {
      const isCurrentActive = active.some((c) => c.id === editingStudent.classId);
      if (!isCurrentActive) {
        const inactiveLinkedClass = classesList.find((c) => c.id === editingStudent.classId);
        if (inactiveLinkedClass) {
          return [
            { value: inactiveLinkedClass.id, label: `${inactiveLinkedClass.className} (Disabled)` },
            ...active.map((c) => ({ value: c.id, label: c.className }))
          ];
        }
      }
    }
    
    return active.map((c) => ({ value: c.id, label: c.className }));
  }, [classesList, editingStudent]);

  // Combined unique values for filters (merging classes from classes collection with legacy text entries)
  const filterClassOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Classes' }];
    
    // Add classes from configured classes list (ordered by displayOrder)
    classesList.forEach((c) => {
      options.push({ value: c.className, label: `Class ${c.className}` });
    });
    
    // Add legacy class string names if they do not match any formal class names
    students.forEach((s) => {
      if (s.class && !options.some((opt) => opt.value === s.class)) {
        options.push({ value: s.class, label: `Class ${s.class}` });
      }
    });
    
    return options;
  }, [classesList, students]);

  const villages = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => s.village && set.add(s.village));
    return Array.from(set).sort();
  }, [students]);

  // Filtered & Searched list
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchSearch = 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.fatherName && student.fatherName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchClass = selectedClass === 'all' || student.class === selectedClass;
      const matchVillage = selectedVillage === 'all' || student.village === selectedVillage;
      const matchGender = selectedGender === 'all' || student.gender === selectedGender;

      return matchSearch && matchClass && matchVillage && matchGender;
    });
  }, [students, searchTerm, selectedClass, selectedVillage, selectedGender]);

  // Paginated elements
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1); // Reset page on filter/search change
  }, [searchTerm, selectedClass, selectedVillage, selectedGender]);

  // Open edit modal
  const handleEditClick = (student: any) => {
    setEditingStudent(student);
    setImagePreview(student.photoUrl || '');
    setImageFile(null);
    
    // Set form fields
    setValue('name', student.name);
    setValue('fatherName', student.fatherName || '');
    setValue('classId', student.classId || '');
    setValue('dob', student.dob || '');
    setValue('gender', student.gender || 'Male');
    setValue('village', student.village || '');
    setValue('email', student.email || '');
    setValue('status', student.status || 'active');

    setIsFormOpen(true);
  };

  // Open create modal
  const handleCreateClick = () => {
    setEditingStudent(null);
    setImagePreview('');
    setImageFile(null);
    reset({
      name: '',
      fatherName: '',
      classId: '',
      dob: '',
      gender: 'Male',
      village: '',
      email: '',
      status: 'active',
    });
    setIsFormOpen(true);
  };

  // Toggle status inline
  const handleToggleStatus = async (student: any) => {
    try {
      const nextStatus = student.status === 'active' ? 'inactive' : 'active';
      const docRef = doc(db, 'students', student.id);
      await updateDoc(docRef, { status: nextStatus });
      toast.success(`${student.name} is now ${nextStatus}.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to change status.');
    }
  };

  // Image Selection Handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  // Submit add/edit student
  const onSubmit = async (data: StudentFormValues) => {
    setUploadingImage(true);
    let finalPhotoUrl = editingStudent?.photoUrl || '';

    try {
      if (imageFile) {
        finalPhotoUrl = await uploadImage(imageFile, 'student-images');
      }

      // Load selected class metadata
      const selectedClassDoc = classesList.find((c) => c.id === data.classId);
      const className = selectedClassDoc ? selectedClassDoc.className : 'Unassigned Class';

      const payload = {
        name: data.name,
        fatherName: data.fatherName,
        classId: data.classId,
        class: className, // Save selected class name string into the legacy class field
        dob: data.dob,
        gender: data.gender,
        village: data.village,
        email: data.email,
        status: data.status,
        photoUrl: finalPhotoUrl,
      };

      if (editingStudent) {
        const docRef = doc(db, 'students', editingStudent.id);
        await updateDoc(docRef, payload);
        toast.success('Student profile updated successfully.');
      } else {
        const newPayload = {
          ...payload,
          registrationDate: Timestamp.now(),
          lastLogin: Timestamp.now(),
          progress: {
            completedTests: 0,
            averageScore: 0,
          }
        };
        await addDoc(collection(db, 'students'), newPayload);
        toast.success('New student registered successfully.');
      }

      setIsFormOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred during save operation.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Confirm delete click
  const handleDeleteClick = (student: any) => {
    setStudentToDelete(student);
    setIsDeleteOpen(true);
  };

  // Execute delete student
  const executeDelete = async () => {
    if (!studentToDelete) return;
    try {
      await deleteDoc(doc(db, 'students', studentToDelete.id));
      toast.success(`${studentToDelete.name} has been deleted.`);
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete student record.');
    }
  };

  // CSV Export Utility
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      toast.warning('No data available to export.');
      return;
    }

    const headers = ['Name', 'Father Name', 'Class', 'DOB', 'Gender', 'Village', 'Email', 'Status', 'Average Score'];
    const rows = filteredStudents.map((s) => [
      s.name,
      s.fatherName,
      s.class || 'Unassigned',
      s.dob,
      s.gender,
      s.village,
      s.email,
      s.status,
      s.progress?.averageScore || 0
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ndcc_students_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV file exported successfully.');
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Add Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Students Directory</h1>
          <p className="text-sm text-muted-foreground">Manage student registrations, profile records, and status options.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button onClick={handleExportCSV} variant="outline" className="cursor-pointer">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleCreateClick} className="cursor-pointer">
            <UserPlus className="h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Filters Box */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="md:col-span-1">
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Class filter */}
          <Select
            options={filterClassOptions}
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          />

          {/* Village filter */}
          <Select
            options={[
              { value: 'all', label: 'All Villages' },
              ...villages.map((v) => ({ value: v, label: v }))
            ]}
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
          />

          {/* Gender filter */}
          <Select
            options={[
              { value: 'all', label: 'All Genders' },
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
              { value: 'Other', label: 'Other' },
            ]}
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
          />
        </div>
      </div>

      {/* Results Container */}
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground select-none">
            <XCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-bold text-foreground">No students found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">Try modifying your query or adjust the filter parameters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                    <th className="py-4 px-6">Student</th>
                    <th className="py-4 px-6">Class</th>
                    <th className="py-4 px-6">Village</th>
                    <th className="py-4 px-6">Father Name</th>
                    <th className="py-4 px-6">Email</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {paginatedStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-secondary/20 transition-all">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          {student.photoUrl ? (
                            <img src={student.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover border border-border shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-xs shrink-0 uppercase">
                              {student.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-foreground">{student.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-foreground">
                        {student.class || 'Unassigned'}
                      </td>
                      <td className="py-3.5 px-6 text-muted-foreground">{student.village}</td>
                      <td className="py-3.5 px-6 font-medium text-foreground">{student.fatherName}</td>
                      <td className="py-3.5 px-6 text-muted-foreground font-mono text-xs">{student.email}</td>
                      <td className="py-3.5 px-6 text-center select-none">
                        <button
                          onClick={() => handleToggleStatus(student)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                            student.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}
                        >
                          <span>{student.status === 'active' ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-6 text-right select-none">
                        <div className="flex items-center justify-end gap-2.5">
                          <Link
                            to={`/students/${student.id}`}
                            className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground border border-border/40 cursor-pointer"
                            title="View Profile Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => handleEditClick(student)}
                            className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground border border-border/40 cursor-pointer"
                            title="Edit Student Details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(student)}
                            className="h-8 w-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive border border-border/40 cursor-pointer"
                            title="Delete Student Profile"
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

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 md:hidden">
              {paginatedStudents.map((student) => (
                <div key={student.id} className="bg-card border border-border/60 rounded-xl p-4 space-y-4 hover:shadow-md transition-all text-left">
                  <div className="flex items-center gap-3">
                    {student.photoUrl ? (
                      <img src={student.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                        {student.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate">{student.name}</p>
                      <p className="text-xs text-muted-foreground">Class {student.class || 'Unassigned'}</p>
                    </div>
                    <button
                      onClick={() => handleToggleStatus(student)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold select-none cursor-pointer ${
                        student.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                      }`}
                    >
                      {student.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-y border-border/40 py-2.5">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Village</span>
                      <span className="font-medium text-foreground truncate block">{student.village}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Father Name</span>
                      <span className="font-medium text-foreground truncate block">{student.fatherName}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Email</span>
                      <span className="font-medium text-foreground truncate block font-mono text-[11px]">{student.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 select-none">
                    <Link to={`/students/${student.id}`} className="text-xs font-semibold py-1.5 px-3 bg-secondary rounded-lg flex items-center gap-1 cursor-pointer">
                      <Eye className="h-3.5 w-3.5" /> View
                    </Link>
                    <button onClick={() => handleEditClick(student)} className="text-xs font-semibold py-1.5 px-3 bg-secondary rounded-lg flex items-center gap-1 cursor-pointer">
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDeleteClick(student)} className="text-xs font-semibold py-1.5 px-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-1 cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="py-4 px-6 border-t border-border/40 flex items-center justify-between select-none">
                <span className="text-xs text-muted-foreground">
                  Showing page <span className="font-semibold text-foreground">{currentPage}</span> of <span className="font-semibold text-foreground">{totalPages}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="cursor-pointer"
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Student Form Modal Dialog (Add / Edit) */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingStudent ? 'Edit Student Profile' : 'Add New Student'}
        description={editingStudent ? 'Update details for this registered student.' : 'Create a new student record database file.'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left select-none">
          
          {/* Avatar upload placeholder */}
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="relative h-20 w-20 rounded-full border border-border group overflow-hidden bg-muted flex items-center justify-center">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <Users className="h-8 w-8 text-muted-foreground/50" />
              )}
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity">
                <Camera className="h-4 w-4" />
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            </div>
            <span className="text-[10px] text-muted-foreground">Click photo to upload</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Student Name" id="name" {...register('name')} error={errors.name?.message} />
            <Input label="Father's Name" id="fatherName" {...register('fatherName')} error={errors.fatherName?.message} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Class Standard"
              id="classId"
              options={[
                { value: '', label: 'Select a Class' },
                ...studentFormClassOptions
              ]}
              {...register('classId')}
              error={errors.classId?.message}
            />
            <Input label="Date of Birth" id="dob" type="date" {...register('dob')} error={errors.dob?.message} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Gender"
              id="gender"
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' },
              ]}
              {...register('gender')}
              error={errors.gender?.message}
            />
            <Input label="Village/Town" id="village" {...register('village')} error={errors.village?.message} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Email Address" id="email" type="email" {...register('email')} error={errors.email?.message} />
            <Select
              label="Status"
              id="status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              {...register('status')}
              error={errors.status?.message}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" isLoading={uploadingImage} className="cursor-pointer">
              {editingStudent ? 'Save Changes' : 'Register Student'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Confirm Deletion"
        description="Are you sure you want to permanently delete this student record? This action is irreversible and will delete all progress history."
        footerActions={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="cursor-pointer">
              Delete Record
            </Button>
          </>
        }
      >
        {studentToDelete && (
          <div className="bg-secondary/30 border border-border/40 p-3 rounded-lg flex items-center gap-3 select-none">
            {studentToDelete.photoUrl ? (
              <img src={studentToDelete.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {studentToDelete.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-bold text-foreground text-left">{studentToDelete.name}</p>
              <p className="text-xs text-muted-foreground text-left">Class {studentToDelete.class} • {studentToDelete.email}</p>
            </div>
          </div>
        )}
      </Dialog>

    </div>
  );
};

export default Students;

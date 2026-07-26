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
  FileCheck, 
  Plus, 
  Edit2, 
  Trash2, 
  Clock, 
  Award, 
  HelpCircle,
  Eye,
  EyeOff,
  PlusCircle,
  MinusCircle,
  BookOpen,
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

const testSchema = zod.object({
  title: zod.string().min(2, 'Title must be at least 2 characters'),
  classId: zod.string().min(1, 'Please select a class'),
  subjectId: zod.string().min(1, 'Please select a subject'),
  time: zod.number().min(1, 'Time must be at least 1 minute'),
  marks: zod.number().min(1, 'Marks must be at least 1 mark'),
  published: zod.boolean(),
});

type TestFormValues = zod.infer<typeof testSchema>;

interface QuestionItem {
  questionText: string;
  options: [string, string, string, string];
  correctOption: number;
}

export const ObjectiveTests: React.FC = () => {
  const toast = useToast();
  const [tests, setTests] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState<any | null>(null);

  // Custom state for managing questions array in the form
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TestFormValues>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      published: false,
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

  // Listen to Tests & Subjects
  useEffect(() => {
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setSubjects(list);
    });

    const unsubTests = onSnapshot(collection(db, 'objectiveTests'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by creation date
      setTests(list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync objective tests list.');
      setLoading(false);
    });

    return () => {
      unsubSubjects();
      unsubTests();
    };
  }, []);

  // Form dropdown options for classes (hides inactive ones unless already linked)
  const testFormClassOptions = useMemo(() => {
    const active = classesList.filter((c) => c.isActive);
    const options = active.map((c) => ({ value: c.id, label: c.className }));

    // If editing a test linked to an inactive class, keep it in the dropdown options
    if (editingTest && editingTest.classId) {
      const isCurrentActive = active.some((c) => c.id === editingTest.classId);
      if (!isCurrentActive) {
        const inactiveLinkedClass = classesList.find((c) => c.id === editingTest.classId);
        if (inactiveLinkedClass) {
          options.push({
            value: inactiveLinkedClass.id,
            label: `${inactiveLinkedClass.className} (Disabled)`
          });
        }
      }
    }
    
    return options;
  }, [classesList, editingTest]);

  // Dynamically filter subjects matching the currently selected classId (or public "all" subjects)
  const filteredSubjects = useMemo(() => {
    if (!watchedClassId) return [];
    
    const list = subjects.filter(
      (sub) => sub.classId === watchedClassId || sub.classId === 'all'
    );

    // If editing and the linked subject isn't present (e.g. inactive or different class), load it
    if (editingTest && editingTest.subjectId && editingTest.classId === watchedClassId) {
      const hasSubject = list.some((sub) => sub.id === editingTest.subjectId);
      if (!hasSubject) {
        const linkedSubject = subjects.find((sub) => sub.id === editingTest.subjectId);
        if (linkedSubject) {
          list.push(linkedSubject);
        }
      }
    }

    return list;
  }, [subjects, watchedClassId, editingTest]);

  const handleCreateClick = () => {
    setEditingTest(null);
    setQuestions([
      {
        questionText: '',
        options: ['', '', '', ''],
        correctOption: 0,
      }
    ]);
    reset({
      title: '',
      classId: '',
      subjectId: '',
      time: 30,
      marks: 50,
      published: false,
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (test: any) => {
    setEditingTest(test);
    setQuestions(test.questions || []);
    reset({
      title: test.title,
      classId: test.classId || '',
      subjectId: test.subjectId || '',
      time: test.time,
      marks: test.marks,
      published: test.published ?? false,
    });
    setIsFormOpen(true);
  };

  const handleTogglePublish = async (test: any) => {
    try {
      const nextState = !test.published;
      await updateDoc(doc(db, 'objectiveTests', test.id), { published: nextState });
      toast.success(`Test is now ${nextState ? 'published' : 'unpublished'}.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to change publish status.');
    }
  };

  // Questions Array Manipulations
  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        questionText: '',
        options: ['', '', '', ''],
        correctOption: 0,
      }
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      toast.warning('A test must contain at least one question.');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionTextChange = (index: number, text: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index].questionText = text;
      return next;
    });
  };

  const handleOptionChange = (qIndex: number, optIndex: number, text: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex].options[optIndex] = text;
      return next;
    });
  };

  const handleCorrectOptionChange = (qIndex: number, optIndex: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex].correctOption = optIndex;
      return next;
    });
  };

  const onSubmit = async (data: TestFormValues) => {
    // Validate questions fields
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        toast.error(`Question ${i + 1} text is empty.`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!q.options[j].trim()) {
          toast.error(`Question ${i + 1}, Option ${j + 1} is empty.`);
          return;
        }
      }
    }

    // Load subject name metadata
    const sub = subjects.find(s => s.id === data.subjectId);
    const subjectName = sub ? sub.name : 'Unknown Subject';

    // Load class standard metadata
    const selectedClassDoc = classesList.find((c) => c.id === data.classId);
    const className = selectedClassDoc ? selectedClassDoc.className : 'Unassigned Class';

    const payload = {
      title: data.title,
      classId: data.classId,
      className, // Save class name string
      subjectId: data.subjectId,
      subjectName,
      time: data.time,
      marks: data.marks,
      published: data.published,
      questions,
    };

    try {
      if (editingTest) {
        await updateDoc(doc(db, 'objectiveTests', editingTest.id), payload);
        toast.success('Test details saved successfully.');
      } else {
        const newPayload = {
          ...payload,
          createdAt: Timestamp.now(),
        };
        await addDoc(collection(db, 'objectiveTests'), newPayload);
        toast.success('New objective test created.');
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save test record.');
    }
  };

  const handleDeleteClick = (test: any) => {
    setTestToDelete(test);
    setIsDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!testToDelete) return;
    try {
      await deleteDoc(doc(db, 'objectiveTests', testToDelete.id));
      toast.success(`${testToDelete.title} has been deleted.`);
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete test.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Objective Tests</h1>
          <p className="text-sm text-muted-foreground">Configure multiple choice question files, duration timers, and publish properties.</p>
        </div>
        <Button onClick={handleCreateClick} className="cursor-pointer">
          <Plus className="h-4.5 w-4.5" />
          Create Test
        </Button>
      </div>

      {/* Tests Listing */}
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground select-none">
            <FileCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-bold text-foreground">No objective tests</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">Get started by creating a multiple choice question paper for assigned courses.</p>
            <Button onClick={handleCreateClick} variant="outline" className="mt-4 cursor-pointer">
              <Plus className="h-4 w-4" /> Create First Test
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                    <th className="py-4 px-6">Test Title</th>
                    <th className="py-4 px-6">Class</th>
                    <th className="py-4 px-6">Subject</th>
                    <th className="py-4 px-6 text-center">Duration</th>
                    <th className="py-4 px-6 text-center">Questions</th>
                    <th className="py-4 px-6 text-center">Marks</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {tests.map((test) => (
                    <tr key={test.id} className="hover:bg-secondary/20 transition-all">
                      <td className="py-3.5 px-6 font-semibold text-foreground">{test.title}</td>
                      <td className="py-3.5 px-6 text-muted-foreground font-semibold">
                        <div className="flex items-center gap-1.5 text-primary">
                          <GraduationCap className="h-4 w-4 shrink-0" />
                          {test.className || 'Unassigned'}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
                          {test.subjectName}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                          {test.time} Mins
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-center text-muted-foreground font-semibold">
                        {test.questions?.length || 0}
                      </td>
                      <td className="py-3.5 px-6 text-center font-bold text-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <Award className="h-3.5 w-3.5 text-amber-500" />
                          {test.marks}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <button
                          onClick={() => handleTogglePublish(test)}
                          className="mx-auto flex text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                          title={test.published ? 'Unpublish' : 'Publish'}
                        >
                          {test.published ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 py-1 px-2.5 rounded-full text-xs font-semibold select-none">
                              <Eye className="h-3.5 w-3.5" />
                              Published
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-muted/40 text-muted-foreground border border-border/40 py-1 px-2.5 rounded-full text-xs font-semibold select-none">
                              <EyeOff className="h-3.5 w-3.5" />
                              Draft
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-6 text-right select-none">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEditClick(test)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all cursor-pointer"
                            title="Edit Test Details"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(test)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                            title="Delete Test"
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

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 md:hidden">
              {tests.map((test) => (
                <div key={test.id} className="bg-card border border-border/60 rounded-xl p-4 space-y-4 hover:shadow-md transition-all text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground truncate max-w-[70%]">{test.title}</p>
                    <button
                      onClick={() => handleTogglePublish(test)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold select-none cursor-pointer ${
                        test.published ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted text-muted-foreground border border-border/40'
                      }`}
                    >
                      {test.published ? 'Published' : 'Draft'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-y border-border/40 py-2.5 text-muted-foreground">
                    <div className="col-span-2 flex items-center gap-1.5 text-primary font-semibold">
                      <GraduationCap className="h-4 w-4" />
                      <span>Class: {test.className || 'Unassigned'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Subject</span>
                      <span className="font-medium text-foreground truncate block">{test.subjectName}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Duration</span>
                      <span className="font-medium text-foreground truncate block">{test.time} Mins</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Questions</span>
                      <span className="font-medium text-foreground truncate block">{test.questions?.length || 0} Items</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Total Score</span>
                      <span className="font-bold text-foreground">{test.marks}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 select-none">
                    <button onClick={() => handleEditClick(test)} className="text-xs font-semibold py-1.5 px-3 bg-secondary rounded-lg flex items-center gap-1 cursor-pointer">
                      <Edit2 className="h-3.5 w-3.5" /> Edit Test
                    </button>
                    <button onClick={() => handleDeleteClick(test)} className="text-xs font-semibold py-1.5 px-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-1 cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Form Dialog Modal for Test Setup */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTest ? 'Modify Test Settings' : 'Create Objective Test'}
        description="Provide testing properties and compile multiple choice questions."
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1 text-left select-none">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Test Paper Title" id="title" placeholder="e.g. Kinematics Chapter Exam" {...register('title')} error={errors.title?.message} />
            <Select
              label="Select Target Class"
              id="classId"
              options={[
                { value: '', label: 'Select standard first' },
                ...testFormClassOptions
              ]}
              {...register('classId')}
              error={errors.classId?.message}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Assign Subject Syllabus"
              id="subjectId"
              options={[
                { value: '', label: watchedClassId ? 'Select subject' : 'First select a class standard' },
                ...filteredSubjects.map((sub) => ({ value: sub.id, label: sub.name }))
              ]}
              disabled={!watchedClassId}
              {...register('subjectId')}
              error={errors.subjectId?.message}
            />
            <Input label="Duration Limit (Minutes)" id="time" type="number" {...register('time', { valueAsNumber: true })} error={errors.time?.message} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Total Score Marks" id="marks" type="number" {...register('marks', { valueAsNumber: true })} error={errors.marks?.message} />
            
            <div className="flex items-center gap-2.5 h-full pt-6">
              <input
                type="checkbox"
                id="published"
                className="h-4 w-4 accent-primary rounded cursor-pointer"
                {...register('published')}
              />
              <label htmlFor="published" className="text-xs font-semibold text-foreground/80 cursor-pointer select-none">
                Publish directly to online examinations folder
              </label>
            </div>
          </div>

          {/* Dynamic Questions Builder Section */}
          <div className="border-t border-border/60 pt-4 space-y-4 select-none">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                <HelpCircle className="h-4.5 w-4.5 text-primary" />
                Compiled Questions ({questions.length})
              </h4>
              <Button type="button" size="sm" onClick={addQuestion} className="cursor-pointer gap-1">
                <PlusCircle className="h-4 w-4" /> Add Question
              </Button>
            </div>

            <div className="space-y-5">
              {questions.map((q, qIndex) => (
                <div key={qIndex} className="bg-secondary/20 border border-border/40 p-4.5 rounded-xl space-y-3.5 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-primary">Question {qIndex + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="text-muted-foreground/60 hover:text-destructive p-1 rounded-md hover:bg-secondary cursor-pointer"
                      title="Remove Question"
                    >
                      <MinusCircle className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  <Input
                    placeholder="Enter question statement..."
                    value={q.questionText}
                    onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-option-${qIndex}`}
                          checked={q.correctOption === optIndex}
                          onChange={() => handleCorrectOptionChange(qIndex, optIndex)}
                          className="h-4 w-4 accent-emerald-500 cursor-pointer"
                          title="Set as correct answer"
                        />
                        <input
                          type="text"
                          value={q.options[optIndex]}
                          placeholder={`Option ${optIndex + 1}`}
                          onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                          className="w-full bg-card text-xs h-8 px-2.5 rounded-md border border-border outline-none focus:border-primary placeholder:text-muted-foreground/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer">
              {editingTest ? 'Save Changes' : 'Create Exam Paper'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Test Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Test Confirmation"
        description="Are you sure you want to permanently delete this exam paper? Students will lose progress results associated with this exam."
        footerActions={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="cursor-pointer">
              Delete Exam Paper
            </Button>
          </>
        }
      >
        {testToDelete && (
          <div className="bg-secondary/40 border border-border/40 rounded-xl p-3.5 text-left select-none">
            <p className="font-bold text-foreground leading-snug">{testToDelete.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Subject: {testToDelete.subjectName} • {testToDelete.questions?.length || 0} Questions</p>
          </div>
        )}
      </Dialog>

    </div>
  );
};

export default ObjectiveTests;

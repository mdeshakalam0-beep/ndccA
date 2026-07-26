import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  MapPin, 
  Calendar, 
  BookOpen, 
  Award, 
  CheckCircle,
  Clock
} from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const StudentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<any | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // Listen to student profile details
    const unsubProfile = onSnapshot(doc(db, 'students', id), (docSnap) => {
      if (docSnap.exists()) {
        setStudent({ id: docSnap.id, ...docSnap.data() });
      } else {
        setStudent(null);
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    // Listen to student test attempts subcollection
    const unsubAttempts = onSnapshot(
      collection(db, 'students', id, 'testAttempts'), 
      (snap) => {
        const list: any[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        // Sort by attempt date
        setAttempts(list.sort((a, b) => (b.completedAt?.toMillis() || 0) - (a.completedAt?.toMillis() || 0)));
      }
    );

    return () => {
      unsubProfile();
      unsubAttempts();
    };
  }, [id]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (attempts.length === 0) {
      return { total: 0, avg: 0, high: 0 };
    }
    const scores = attempts.map(a => (a.score / a.totalMarks) * 100);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / attempts.length);
    const high = Math.round(Math.max(...scores));
    return {
      total: attempts.length,
      avg,
      high
    };
  }, [attempts]);

  // Prepare chart data
  const chartData = React.useMemo(() => {
    return [...attempts]
      .reverse() // chronological order
      .map((a, i) => ({
        index: i + 1,
        score: Math.round((a.score / a.totalMarks) * 100),
        name: a.testTitle || `Test ${i + 1}`
      }));
  }, [attempts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center select-none">
        <h2 className="text-xl font-bold text-foreground">Student profile not found</h2>
        <p className="text-sm text-muted-foreground mt-1">The requested student ID is invalid or has been deleted.</p>
        <Link to="/students" className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2 inline" /> Back to Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Back Button Navigation */}
      <div className="flex items-center text-left">
        <Link to="/students" className="text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
          Back to Students List
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-left">
        
        {/* Left Column: Profile Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm space-y-6 lg:col-span-1">
          {/* Avatar & Basic Info */}
          <div className="flex flex-col items-center text-center pb-5 border-b border-border/40 select-none">
            {student.photoUrl ? (
              <img src={student.photoUrl} alt="" className="h-24 w-24 rounded-full object-cover border-2 border-primary/20 shadow-md mb-4" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold mb-4 uppercase">
                {student.name.charAt(0)}
              </div>
            )}
            <h2 className="text-xl font-bold text-foreground leading-tight">{student.name}</h2>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Class {student.class}</p>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border mt-3 uppercase tracking-wider ${
              student.status === 'active' 
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600' 
                : 'bg-muted/40 border-border text-muted-foreground'
            }`}>
              {student.status || 'Active'}
            </span>
          </div>

          {/* Detailed Info Fields */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Father Name</span>
                <span className="text-sm font-medium text-foreground">{student.fatherName || 'Not Provided'}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Email Address</span>
                <span className="text-sm font-medium text-foreground block truncate">{student.email}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Village / Town</span>
                <span className="text-sm font-medium text-foreground">{student.village || 'Not Provided'}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Date of Birth</span>
                <span className="text-sm font-medium text-foreground">
                  {student.dob ? new Date(student.dob).toLocaleDateString([], { dateStyle: 'medium' }) : 'Not Provided'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Registration Date</span>
                <span className="text-sm font-medium text-foreground">
                  {student.registrationDate ? new Date(student.registrationDate.toMillis()).toLocaleDateString([], { dateStyle: 'medium' }) : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Last Activity</span>
                <span className="text-sm font-medium text-foreground">
                  {student.lastLogin ? new Date(student.lastLogin.toMillis()).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Progress Charts & Test Attempts */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Statistical Badges */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border/80 rounded-2xl p-4.5 shadow-sm text-left">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 select-none">
                <BookOpen className="h-4 w-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Tests Run</span>
              </div>
              <p className="text-2xl font-black text-foreground">{stats.total}</p>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-4.5 shadow-sm text-left">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 select-none">
                <Award className="h-4 w-4 text-primary" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Average %</span>
              </div>
              <p className="text-2xl font-black text-foreground">{stats.avg}%</p>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-4.5 shadow-sm text-left">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 select-none">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-[10px] uppercase font-bold tracking-wider">High %</span>
              </div>
              <p className="text-2xl font-black text-foreground">{stats.high}%</p>
            </div>
          </div>

          {/* Recharts Analytics Progression */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold tracking-tight text-foreground mb-4">Progress Performance Graph</h3>
            <div className="h-64 w-full">
              {attempts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground/60 text-sm select-none">
                  No testing progress to map yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--color-border), 0.15)" />
                    <XAxis dataKey="index" tick={{ fill: 'gray', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'gray', fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                      labelStyle={{ color: 'var(--color-muted-foreground)', fontSize: 10 }}
                      itemStyle={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 'bold' }}
                      formatter={(val) => [`${val}%`, 'Score']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3} 
                      activeDot={{ r: 6 }} 
                      dot={{ strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Test History List */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h3 className="text-base font-bold tracking-tight text-foreground">Completed Tests Log</h3>
            <div className="overflow-x-auto">
              {attempts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground/50 text-sm select-none">
                  No tests have been completed by this student.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-3">Test Title</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3 text-center">Score</th>
                      <th className="py-2.5 px-3 text-right">Completed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-sm">
                    {attempts.map((attempt) => {
                      const percentage = Math.round((attempt.score / attempt.totalMarks) * 100);
                      return (
                        <tr key={attempt.id} className="hover:bg-secondary/20 transition-all">
                          <td className="py-3 px-3 font-semibold text-foreground">{attempt.testTitle}</td>
                          <td className="py-3 px-3 text-muted-foreground text-xs">{attempt.subjectName}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block text-xs font-bold py-0.5 px-2.5 rounded-full ${
                              percentage >= 75 ? 'bg-emerald-500/10 text-emerald-600' :
                              percentage >= 50 ? 'bg-blue-500/10 text-blue-600' :
                              'bg-rose-500/10 text-rose-600'
                            }`}>
                              {attempt.score}/{attempt.totalMarks} ({percentage}%)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-muted-foreground text-xs">
                            {attempt.completedAt ? new Date(attempt.completedAt.toMillis()).toLocaleDateString([], { dateStyle: 'medium' }) : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentDetails;

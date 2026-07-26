import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, Timestamp, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  Users, 
  BookOpen, 
  FileCheck, 
  Bell, 
  Image as ImageIcon,
  TrendingUp,
  UserPlus,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Skeleton from '../components/ui/Skeleton';

interface ActivityItem {
  id: string;
  type: 'student' | 'subject' | 'test' | 'notification';
  title: string;
  subtitle: string;
  timestamp: Timestamp;
}

export const DashboardHome: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    students: 0,
    subjects: 0,
    tests: 0,
    notifications: 0,
    banners: 0,
  });
  
  const [todayRegistrations, setTodayRegistrations] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // 1. Listen to counts in real time
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setCounts(prev => ({ ...prev, students: snap.size }));
    });

    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      setCounts(prev => ({ ...prev, subjects: snap.size }));
    });

    const unsubTests = onSnapshot(collection(db, 'objectiveTests'), (snap) => {
      setCounts(prev => ({ ...prev, tests: snap.size }));
    });

    const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snap) => {
      setCounts(prev => ({ ...prev, notifications: snap.size }));
    });

    const unsubBanners = onSnapshot(collection(db, 'heroBanners'), (snap) => {
      setCounts(prev => ({ ...prev, banners: snap.size }));
    });

    // 2. Listen to today's registrations in real time
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const qToday = query(
      collection(db, 'students'),
      where('registrationDate', '>=', Timestamp.fromDate(startOfToday))
    );
    const unsubTodayReg = onSnapshot(qToday, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTodayRegistrations(list.sort((a, b) => b.registrationDate.toMillis() - a.registrationDate.toMillis()));
    });

    // 3. Listen to recent changes to create an activity stream
    const qRecentStudents = query(collection(db, 'students'), orderBy('registrationDate', 'desc'), limit(3));
    const qRecentTests = query(collection(db, 'objectiveTests'), orderBy('createdAt', 'desc'), limit(3));
    const qRecentNotifications = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(3));

    let localStudents: ActivityItem[] = [];
    let localTests: ActivityItem[] = [];
    let localNotifications: ActivityItem[] = [];

    const mergeActivities = () => {
      const merged = [...localStudents, ...localTests, ...localNotifications]
        .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
        .slice(0, 5);
      setRecentActivities(merged);
      setLoading(false);
    };

    const unsubRecStudents = onSnapshot(qRecentStudents, (snap) => {
      localStudents = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          type: 'student' as const,
          title: 'New Student Registered',
          subtitle: `${d.name} (${d.class})`,
          timestamp: d.registrationDate || Timestamp.now()
        };
      });
      mergeActivities();
    });

    const unsubRecTests = onSnapshot(qRecentTests, (snap) => {
      localTests = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          type: 'test' as const,
          title: 'Objective Test Published',
          subtitle: `${d.title} - ${d.marks} Marks`,
          timestamp: d.createdAt || Timestamp.now()
        };
      });
      mergeActivities();
    });

    const unsubRecNotifications = onSnapshot(qRecentNotifications, (snap) => {
      localNotifications = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          type: 'notification' as const,
          title: 'Broadcast Sent',
          subtitle: d.title,
          timestamp: d.createdAt || Timestamp.now()
        };
      });
      mergeActivities();
    });

    return () => {
      unsubStudents();
      unsubSubjects();
      unsubTests();
      unsubNotifications();
      unsubBanners();
      unsubTodayReg();
      unsubRecStudents();
      unsubRecTests();
      unsubRecNotifications();
    };
  }, []);

  const stats = [
    { title: 'Total Students', value: counts.students, icon: Users, color: 'text-violet-500 bg-violet-500/10 border-violet-500/15', link: '/students' },
    { title: 'Total Subjects', value: counts.subjects, icon: BookOpen, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/15', link: '/subjects' },
    { title: 'Objective Tests', value: counts.tests, icon: FileCheck, color: 'text-blue-500 bg-blue-500/10 border-blue-500/15', link: '/tests' },
    { title: 'Notifications', value: counts.notifications, icon: Bell, color: 'text-rose-500 bg-rose-500/10 border-rose-500/15', link: '/notifications' },
    { title: 'Hero Banners', value: counts.banners, icon: ImageIcon, color: 'text-amber-500 bg-amber-500/10 border-amber-500/15', link: '/banners' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header Title */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between text-left">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time control status for New Direction Coaching Centre.</p>
        </div>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm flex flex-col gap-4 text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{stat.title}</span>
                <div className={`p-2 rounded-xl border ${stat.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
                )}
                <Link to={stat.link} className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer">
                  Manage <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Grid: Registrations and Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Today's Registrations Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 flex flex-col gap-4 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold tracking-tight">Today's Registrations</h2>
            </div>
            <span className="text-xs bg-primary/10 text-primary font-semibold py-1 px-2.5 rounded-full select-none">
              {todayRegistrations.length} new
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] pr-1.5 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3.5 p-3 rounded-xl border border-border/40">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                </div>
              ))
            ) : todayRegistrations.length === 0 ? (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-muted-foreground p-6 select-none">
                <Clock className="h-8 w-8 text-muted-foreground/40 mb-2.5" />
                <p className="text-sm font-semibold">No registrations today</p>
                <p className="text-xs text-muted-foreground/60 max-w-xs mt-0.5">Students who register today will appear here in real time.</p>
              </div>
            ) : (
              todayRegistrations.map((student) => (
                <Link
                  key={student.id}
                  to={`/students/${student.id}`}
                  className="flex items-center gap-3.5 p-3 rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/50 hover:border-border transition-all cursor-pointer group"
                >
                  {student.photoUrl ? (
                    <img src={student.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-border shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm shrink-0 uppercase">
                      {student.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {student.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      Class {student.class} • {student.village}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 flex flex-col gap-4 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-bold tracking-tight">Recent Updates</h2>
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">Real-time Stream</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] pr-1.5 space-y-4 relative">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-grow space-y-2 mt-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))
            ) : recentActivities.length === 0 ? (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-muted-foreground p-6 select-none">
                <Clock className="h-8 w-8 text-muted-foreground/40 mb-2.5" />
                <p className="text-sm font-semibold">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex gap-4 items-start relative z-10 group">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center border border-background shrink-0 shadow-sm ${
                      activity.type === 'student' ? 'bg-violet-500/10 text-violet-500' :
                      activity.type === 'test' ? 'bg-blue-500/10 text-blue-500' :
                      activity.type === 'notification' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {activity.type === 'student' && <Users className="h-4 w-4" />}
                      {activity.type === 'test' && <FileCheck className="h-4 w-4" />}
                      {activity.type === 'notification' && <Bell className="h-4 w-4" />}
                      {activity.type === 'subject' && <BookOpen className="h-4 w-4" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {activity.subtitle}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(activity.timestamp.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardHome;

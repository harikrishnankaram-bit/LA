import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, eachDayOfInterval } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Building2, Home, Activity, Clock } from 'lucide-react';

const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const CustomEvent = ({ event }: any) => {
    const isPresent = event.resource.status === 'PRESENT';
    const isLate = event.resource.status === 'LATE';
    const isAbsent = event.resource.status === 'ABSENT';
    const isHoliday = event.resource.status === 'HOLIDAY';
    const isWeekend = event.resource.status === 'WEEKEND';
    const isLeave = event.resource.status === 'LEAVE';

    // Maximum Contrast Styles - Solid Backgrounds with White Text
    let bgClass = 'bg-blue-600 border-blue-700 text-white';

    if (isPresent) {
        bgClass = 'bg-emerald-600 border-emerald-700 text-white';
    } else if (isLate) {
        bgClass = 'bg-amber-500 border-amber-600 text-white';
    } else if (isAbsent) {
        bgClass = 'bg-red-600 border-red-700 text-white';
    } else if (isHoliday) {
        bgClass = 'bg-purple-600 border-purple-700 text-white';
    } else if (isLeave) {
        bgClass = 'bg-indigo-600 border-indigo-700 text-white';
    } else if (isWeekend) {
        bgClass = 'bg-slate-200 border-slate-300 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300';
    }

    if (isHoliday || isWeekend || isLeave) {
        return (
            <div className={`text-[9px] p-1.5 rounded-lg border ${bgClass} text-center font-black uppercase tracking-tighter shadow-sm`}>
                {event.resource.status}
            </div>
        );
    }

    return (
        <div className={`text-[9px] p-2 rounded-lg border ${bgClass} shadow-md`}>
            <div className="flex items-center gap-1.5 font-black mb-1 uppercase tracking-tighter">
                {event.resource.mode === 'WFO' ? <Building2 className="w-3 h-3 text-white/80" /> : (event.resource.mode === 'WFH' ? <Home className="w-3 h-3 text-white/80" /> : null)}
                <span className="text-white">{event.title}</span>
            </div>
            {event.resource.login_time && (
                <div className="font-mono font-bold text-white/90 flex items-center gap-1 scale-[0.9] origin-left">
                    <Clock className="w-2.5 h-2.5" />
                    {format(new Date(event.resource.login_time), 'HH:mm')}
                </div>
            )}
        </div>
    );
};

const AttendanceCalendar = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());

    const { data: events = [] } = useQuery({
        queryKey: ['attendance-calendar', user?.id, currentDate.getMonth(), currentDate.getFullYear()],
        queryFn: async () => {
            if (!user) return [];

            const startMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            const startDateStr = format(startMonth, 'yyyy-MM-dd');
            const endDateStr = format(endMonth, 'yyyy-MM-dd');

            const [attendanceRes, leavesRes] = await Promise.all([
                supabase
                    .from('attendance_daily')
                    .select('*')
                    .eq('user_id', user.id)
                    .gte('date', startDateStr)
                    .lte('date', endDateStr),
                supabase
                    .from('leaves')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'APPROVED')
                    .or(`from_date.lte.${endDateStr},to_date.gte.${startDateStr}`)
            ]);

            const attendanceRecords = attendanceRes.data || [];
            const leaveRecords = leavesRes.data || [];
            const attendanceMap = new Map(attendanceRecords.map(a => [a.date, a]));

            const leaveMap = new Map();
            leaveRecords.forEach(l => {
                const leaveStart = new Date(l.from_date);
                const leaveEnd = new Date(l.to_date);
                eachDayOfInterval({ start: leaveStart, end: leaveEnd }).forEach(day => {
                    leaveMap.set(format(day, 'yyyy-MM-dd'), l);
                });
            });

            const calendarEvents = [];
            const daysInMonth = eachDayOfInterval({ start: startMonth, end: endMonth });

            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const now = new Date();
            const cutoff = new Date();
            cutoff.setHours(11, 30, 0, 0);

            for (const d of daysInMonth) {
                const dateKey = format(d, 'yyyy-MM-dd');
                const existingAtt = attendanceMap.get(dateKey);
                const existingLeave = leaveMap.get(dateKey);

                if (existingAtt) {
                    calendarEvents.push({
                        id: existingAtt.id,
                        title: existingAtt.status,
                        start: new Date(existingAtt.login_time || existingAtt.date + 'T10:00:00'),
                        end: existingAtt.logout_time ? new Date(existingAtt.logout_time) : new Date(existingAtt.login_time || existingAtt.date + 'T18:00:00'),
                        allDay: false,
                        resource: existingAtt,
                    });
                } else if (existingLeave) {
                    calendarEvents.push({
                        id: `leave-approved-${existingLeave.id}-${dateKey}`,
                        title: 'LEAVE',
                        start: d,
                        end: d,
                        allDay: true,
                        resource: { status: 'LEAVE', date: dateKey },
                    });
                } else if (dateKey <= todayStr) {
                    // Logic for missing punches
                    if (dateKey === todayStr && now < cutoff) {
                        // Skip today if before cutoff
                        continue;
                    }

                    if (getDay(d) === 0) { // Sunday Detection
                        calendarEvents.push({
                            id: `sun-${dateKey}`,
                            title: 'HOLIDAY',
                            start: d,
                            end: d,
                            allDay: true,
                            resource: { status: 'HOLIDAY', date: dateKey },
                        });
                    } else {
                        // Mark as LEAVE if missing punch
                        calendarEvents.push({
                            id: `leave-missing-${dateKey}`,
                            title: 'LEAVE',
                            start: d,
                            end: d,
                            allDay: true,
                            resource: { status: 'LEAVE', date: dateKey },
                        });
                    }
                }
            }

            return calendarEvents;
        },
        enabled: !!user,
    });

    return (
        <Card className="h-full w-full border-none bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0 pb-6">
                <CardTitle className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2 text-foreground/50">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Attendance Calendar
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[500px] p-0">
                <div className="h-full calendar-container">
                    <Calendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: '100%' }}
                        views={[Views.MONTH]}
                        defaultView={Views.MONTH}
                        onNavigate={(date) => setCurrentDate(date)}
                        date={currentDate}
                        components={{
                            event: CustomEvent
                        }}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default AttendanceCalendar;

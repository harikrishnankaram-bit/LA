import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, eachDayOfInterval } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Building2, Home, Activity } from 'lucide-react';

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

    let bgClass = 'bg-blue-50 border-blue-200 text-blue-700';
    if (isPresent) bgClass = 'bg-green-50 border-green-200 text-green-700';
    if (isLate) bgClass = 'bg-orange-50 border-orange-200 text-orange-700';
    if (isAbsent) bgClass = 'bg-red-50 border-red-200 text-red-700';
    if (isHoliday) bgClass = 'bg-purple-50 border-purple-200 text-purple-700';
    if (isWeekend) bgClass = 'bg-gray-100 border-gray-300 text-gray-700';

    if (isHoliday || isWeekend) {
        return (
            <div className={`text-xs p-1 rounded border overflow-hidden ${bgClass} text-center font-semibold`}>
                {event.resource.status}
            </div>
        );
    }

    return (
        <div className={`text-xs p-1 rounded border overflow-hidden ${bgClass}`}>
            <div className="flex items-center gap-1 font-semibold mb-0.5">
                {event.resource.mode === 'WFO' ? <Building2 className="w-3 h-3" /> : (event.resource.mode === 'WFH' ? <Home className="w-3 h-3" /> : null)}
                <span>{event.title}</span>
            </div>
            {event.resource.login_time && (
                <div>
                    Login: {format(new Date(event.resource.login_time), 'HH:mm')}
                </div>
            )}
            {event.end && event.resource.logout_time && (
                <div>
                    Logout: {format(new Date(event.resource.logout_time), 'HH:mm')}
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

            const { data } = await supabase
                .from('attendance_daily')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', format(startMonth, 'yyyy-MM-dd'))
                .lte('date', format(endMonth, 'yyyy-MM-dd'));

            const attendanceRecords = data || [];
            const attendanceMap = new Map(attendanceRecords.map(a => [a.date, a]));

            const calendarEvents = [];

            // Temporal Projection: Generate Sunday Holidays & Attendance
            const daysInMonth = eachDayOfInterval({ start: startMonth, end: endMonth });

            for (const d of daysInMonth) {
                const dateKey = format(d, 'yyyy-MM-dd');
                const existing = attendanceMap.get(dateKey);

                if (existing) {
                    calendarEvents.push({
                        id: existing.id,
                        title: existing.status,
                        start: new Date(existing.login_time || existing.date + 'T10:00:00'),
                        end: existing.logout_time ? new Date(existing.logout_time) : new Date(existing.login_time || existing.date + 'T18:00:00'),
                        allDay: false,
                        resource: existing,
                    });
                } else if (getDay(d) === 0) { // Sunday Detection
                    calendarEvents.push({
                        id: `sun-${dateKey}`,
                        title: 'HOLIDAY',
                        start: d,
                        end: d,
                        allDay: true,
                        resource: { status: 'HOLIDAY', date: dateKey },
                    });
                }
            }

            return calendarEvents;
        },
        enabled: !!user,
    });

    return (
        <Card className="h-[600px] w-full border-none bg-transparent">
            <CardHeader className="px-0">
                <CardTitle className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2 text-slate-400">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Attendance Matrix
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[500px] p-0">
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
            </CardContent>
        </Card>
    );
};

export default AttendanceCalendar;

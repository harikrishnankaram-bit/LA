import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Building2, Home } from 'lucide-react';

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

    let bgClass = 'bg-blue-50 border-blue-200 text-blue-700';
    if (isPresent) bgClass = 'bg-green-50 border-green-200 text-green-700';
    if (isLate) bgClass = 'bg-orange-50 border-orange-200 text-orange-700';
    if (isAbsent) bgClass = 'bg-red-50 border-red-200 text-red-700';

    return (
        <div className={`text-xs p-1 rounded border overflow-hidden ${bgClass}`}>
            <div className="flex items-center gap-1 font-semibold mb-0.5">
                {event.resource.mode === 'WFO' ? <Building2 className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                <span>{event.title}</span>
            </div>
            <div>
                Login: {format(new Date(event.start), 'HH:mm')}
            </div>
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

            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            const { data } = await supabase
                .from('attendance_daily')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', format(startOfMonth, 'yyyy-MM-dd'))
                .lte('date', format(endOfMonth, 'yyyy-MM-dd'));

            return (data || []).map((att: any) => ({
                id: att.id,
                title: att.status,
                start: new Date(att.login_time || att.date + 'T10:00:00'), // Fallback for absent?
                end: att.logout_time ? new Date(att.logout_time) : new Date(att.login_time || att.date + 'T18:00:00'),
                allDay: false,
                resource: att,
            }));
        },
        enabled: !!user,
    });

    return (
        <Card className="h-[600px] w-full">
            <CardHeader>
                <CardTitle>Attendance Calendar</CardTitle>
            </CardHeader>
            <CardContent className="h-[500px]">
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

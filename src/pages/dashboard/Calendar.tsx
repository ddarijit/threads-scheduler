import { useState, useEffect } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    addDays,
    subDays,
    isToday,
    eachHourOfInterval,
    startOfDay,
    endOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreateThreadModal } from '../../components/CreateThreadModal';
import type { Thread } from './Queue';
import '../../styles/Calendar.css';



export const Calendar = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<Thread[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'month' | 'day'>('month');

    // Edit Modal State
    const [editingThread, setEditingThread] = useState<Thread | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        if (user) {
            fetchEvents();
        }
    }, [user, currentDate, view]);

    const fetchEvents = async () => {
        setLoading(true);
        let start, end;

        if (view === 'month') {
            start = startOfWeek(startOfMonth(currentDate));
            end = endOfWeek(endOfMonth(currentDate));
        } else {
            start = startOfDay(currentDate);
            end = endOfDay(currentDate);
        }

        const { data, error } = await supabase
            .from('threads')
            .select('*')
            .not('scheduled_time', 'is', null)
            .gte('scheduled_time', start.toISOString())
            .lte('scheduled_time', end.toISOString());

        if (error) {
            console.error('Error fetching calendar events:', error);
        } else {
            setEvents(data || []);
        }
        setLoading(false);
    };



    const handleDragStart = (e: React.DragEvent, eventId: string) => {
        e.dataTransfer.setData('eventId', eventId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const eventId = e.dataTransfer.getData('eventId');
        const event = events.find(ev => ev.id === eventId);
        if (!event) return;

        const newDate = new Date(date);
        if (event.scheduled_time) {
            const originalDate = new Date(event.scheduled_time);
            newDate.setHours(originalDate.getHours(), originalDate.getMinutes());
        }

        setEvents(prev => prev.map(ev =>
            ev.id === eventId ? { ...ev, scheduled_time: newDate.toISOString() } : ev
        ));

        try {
            await supabase
                .from('threads')
                .update({ scheduled_time: newDate.toISOString() })
                .eq('id', eventId);
        } catch (err: any) {
            fetchEvents();
        }
    };

    const navigateNext = () => {
        if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
        else setCurrentDate(addDays(currentDate, 1));
    };

    const navigatePrev = () => {
        if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
        else setCurrentDate(subDays(currentDate, 1));
    };

    const renderHeader = () => (
        <div className="calendar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2>{format(currentDate, view === 'month' ? 'MMMM yyyy' : 'EEEE, MMMM d')}</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={navigatePrev} className="nav-btn"><ChevronLeft size={20} /></button>
                    <button onClick={navigateNext} className="nav-btn"><ChevronRight size={20} /></button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
                    <button
                        onClick={() => setView('month')}
                        className={`nav-btn ${view === 'month' ? 'active' : ''}`}
                        style={{ background: view === 'month' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '6px', padding: '4px 12px', fontSize: '0.9rem' }}
                    >
                        Month
                    </button>
                    <button
                        onClick={() => setView('day')}
                        className={`nav-btn ${view === 'day' ? 'active' : ''}`}
                        style={{ background: view === 'day' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '6px', padding: '4px 12px', fontSize: '0.9rem' }}
                    >
                        Day
                    </button>
                </div>
                <button onClick={() => setCurrentDate(new Date())} className="today-btn">Today</button>
            </div>
        </div>
    );

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let day = startDate;

        rows.push(
            <div className="grid grid-cols-7 mb-2" key="header">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="day-name">{day}</div>
                ))}
            </div>
        );

        const cells = [];
        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const cloneDay = day;
                const dateKey = day.toISOString();
                const dayEvents = events.filter(e => e.scheduled_time && isSameDay(new Date(e.scheduled_time), cloneDay));
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isDayToday = isToday(day);

                cells.push(
                    <div
                        className={`calendar-cell ${isCurrentMonth ? 'current-month' : 'other-month'} ${isDayToday ? 'today' : ''}`}
                        key={dateKey}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, cloneDay)}
                        onClick={() => {
                            if (view === 'month') {
                                setCurrentDate(cloneDay);
                                setView('day');
                            }
                        }}
                    >
                        <div className="date-number">{format(day, 'd')}</div>
                        <div className="events-list">
                            {dayEvents.map(event => (
                                <div
                                    key={event.id}
                                    className={`event-item ${event.status}`}
                                    title={event.content}
                                    draggable
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        handleDragStart(e, event.id);
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (event.status !== 'published') {
                                            setEditingThread(event);
                                            setIsCreateModalOpen(true);
                                        }
                                    }}
                                >
                                    <span className="event-time">{event.scheduled_time ? format(new Date(event.scheduled_time), 'HH:mm') : ''}</span>
                                    {event.content}
                                </div>
                            ))}
                        </div>
                    </div>
                );
                day = new Date(day.setDate(day.getDate() + 1));
            }
        }

        const gridRows = [];
        for (let i = 0; i < cells.length; i += 7) {
            gridRows.push(
                <div className="grid grid-cols-7" key={i}>
                    {cells.slice(i, i + 7)}
                </div>
            );
        }

        return (
            <div className="month-view">
                {rows}
                <div className="calendar-grid">{gridRows}</div>
            </div>
        );
    };

    const renderDayView = () => {
        const hours = eachHourOfInterval({
            start: startOfDay(currentDate),
            end: endOfDay(currentDate)
        });

        const now = new Date();
        const minutes = now.getMinutes();
        const topOffset = minutes / 60 * 81; // 81px row height (80px + 1px border)

        return (
            <div className="day-view-container">
                {hours.map(hour => {
                    const hourEvents = events.filter(e => {
                        if (!e.scheduled_time) return false;
                        const eventDate = new Date(e.scheduled_time);
                        return isSameDay(eventDate, currentDate) && eventDate.getHours() === hour.getHours();
                    });

                    return (
                        <div key={hour.toString()} className="day-view-row">
                            <div className="hour-label">
                                {format(hour, 'h a')}
                            </div>
                            <div className="hour-content">
                                {hourEvents.map(event => (
                                    <div
                                        key={event.id}
                                        className={`day-event-card ${event.status}`}
                                        onClick={() => {
                                            if (event.status !== 'published') {
                                                setEditingThread(event);
                                                setIsCreateModalOpen(true);
                                            }
                                        }}
                                    >
                                        <span className="event-time-badge">
                                            {event.scheduled_time ? format(new Date(event.scheduled_time), 'h:mm a') : ''}
                                        </span>
                                        {event.content}
                                    </div>
                                ))}

                                {isToday(currentDate) && now.getHours() === hour.getHours() && (
                                    <div
                                        className="current-time-line"
                                        style={{ top: `${topOffset}px` }}
                                    >
                                        <div className="current-time-dot"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="calendar-container">
            {renderHeader()}

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '500px' }}>
                    <Loader2 className="animate-spin" style={{ color: '#3b82f6' }} size={32} />
                </div>
            ) : view === 'month' ? renderMonthView() : renderDayView()}

            {/* Edit Modal */}
            <CreateThreadModal
                isOpen={isCreateModalOpen || !!editingThread}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingThread(null);
                }}
                onSuccess={() => {
                    fetchEvents();
                    setIsCreateModalOpen(false);
                    setEditingThread(null);
                }}
                threadToEdit={editingThread}
            />
        </div>
    );
};


"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import { GlassTabButton, GLASS_TAB_GROUP } from "@/components/ui/GlassTabButton";
import { PlannerPlatformIcon } from "./PlannerPlatformIcon";
import {
  addMonths,
  addDays,
  dateKey,
  formatTime,
  isToday,
  monthGrid,
  monthTitle,
  weekGrid,
  weekTitle,
  WEEKDAY_LABELS,
} from "@/lib/calendar";
import {
  fetchScheduledPosts,
  type ScheduledPost,
  type ScheduledPostStatus,
} from "@/lib/scheduledPosts";
import { SchedulePostModal } from "./SchedulePostModal";

type CalendarRange = "month" | "week";

interface CalendarViewProps {
  userId: string | null;
  productName?: string;
  notice?: { kind: "success" | "error"; text: string } | null;
}

const STATUS_STYLES: Record<ScheduledPostStatus, string> = {
  scheduled: "bg-violet-500/20 text-violet-200 border-violet-500/30",
  queued: "bg-amber-500/20 text-amber-200 border-amber-500/30",
  published: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
  failed: "bg-rose-500/20 text-rose-200 border-rose-500/30",
};

function PostCard({ post }: { post: ScheduledPost }) {
  return (
    <div className="rounded-lg border border-violet-900/40 bg-slate-950/70 overflow-hidden text-left">
      <div className="flex gap-1.5 p-1.5">
        <div className="h-9 w-9 rounded-md overflow-hidden bg-slate-900 shrink-0">
          {post.mediaType === "video" ? (
            <video src={post.mediaUrl} className="h-full w-full object-cover" muted />
          ) : (
            <img src={post.mediaUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-200 truncate">
              <PlannerPlatformIcon platform={post.platform} className="w-3 h-3" />
              {post.accountLabel || post.platform}
            </span>
            <span className="text-[9px] font-medium text-violet-200 bg-violet-600/20 border border-violet-500/30 rounded px-1 py-px">
              {formatTime(post.scheduledAt)}
            </span>
          </div>
          <span
            className={`mt-1 inline-flex rounded border px-1 py-px text-[9px] font-medium capitalize ${STATUS_STYLES[post.status]}`}
          >
            {post.status}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CalendarView({ userId, productName, notice = null }: CalendarViewProps) {
  const [range, setRange] = useState<CalendarRange>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleDay, setScheduleDay] = useState<Date | null>(null);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      setPosts(await fetchScheduledPosts(userId));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const days = useMemo(
    () => (range === "month" ? monthGrid(cursor) : weekGrid(cursor)),
    [cursor, range]
  );

  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const post of posts) {
      const key = dateKey(new Date(post.scheduledAt));
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [posts]);

  const title = range === "month" ? monthTitle(cursor) : weekTitle(cursor);
  const inCurrentMonth = (day: Date) => day.getMonth() === cursor.getMonth();

  const shift = (direction: -1 | 1) => {
    setCursor((current) =>
      range === "month" ? addMonths(current, direction) : addDays(current, direction * 7)
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-5">
      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs ${
            notice.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {notice.text}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="p-2 rounded-xl border border-violet-900/30 bg-slate-950/40 text-slate-300 hover:text-white hover:border-violet-500/30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="min-w-[12rem] text-center text-sm font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={() => shift(1)}
            className="p-2 rounded-xl border border-violet-900/30 bg-slate-950/40 text-slate-300 hover:text-white hover:border-violet-500/30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-300 border border-violet-900/30 hover:text-white hover:bg-white/[0.05]"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`${GLASS_TAB_GROUP} inline-flex p-1`}>
            <GlassTabButton
              active={range === "month"}
              layoutId="calendarRangeActive"
              onClick={() => setRange("month")}
            >
              Month View
            </GlassTabButton>
            <GlassTabButton
              active={range === "week"}
              layoutId="calendarRangeActive"
              onClick={() => setRange("week")}
            >
              Week View
            </GlassTabButton>
          </div>
          <button
            type="button"
            onClick={() => setScheduleDay(new Date())}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 via-indigo-500 to-fuchsia-500 shadow-[0_0_25px_rgba(124,58,237,0.3)]"
          >
            <Plus className="w-3.5 h-3.5" /> New Scheduled Post
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-violet-900/30 bg-slate-900/40 backdrop-blur-md overflow-hidden">
        <div className="grid grid-cols-7 border-b border-violet-900/30">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500"
            >
              {label}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            Loading calendar...
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dateKey(day);
              const dayPosts = postsByDay.get(key) ?? [];
              const muted = range === "month" && !inCurrentMonth(day);
              const today = isToday(day);

              return (
                <button
                  key={key + String(range)}
                  type="button"
                  onClick={() => setScheduleDay(day)}
                  className={`min-h-[7.5rem] border-r border-b border-violet-900/20 p-2 text-left align-top transition hover:bg-white/[0.04] ${
                    range === "week" ? "min-h-[14rem]" : ""
                  } ${muted ? "bg-slate-950/30" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`h-6 w-6 inline-flex items-center justify-center rounded-full text-[11px] font-semibold ${
                        today
                          ? "bg-violet-600 text-white shadow-[0_0_25px_rgba(124,58,237,0.3)]"
                          : muted
                            ? "text-slate-600"
                            : "text-slate-300"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="text-[9px] text-violet-300">{dayPosts.length}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayPosts.slice(0, range === "week" ? 6 : 2).map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                    {dayPosts.length > (range === "week" ? 6 : 2) && (
                      <p className="text-[10px] text-slate-500 px-1">
                        +{dayPosts.length - (range === "week" ? 6 : 2)} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {scheduleDay && (
        <SchedulePostModal
          day={scheduleDay}
          userId={userId}
          productName={productName}
          onClose={() => setScheduleDay(null)}
          onCreated={(post) => setPosts((prev) => [...prev, post])}
        />
      )}
    </div>
  );
}

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommunityReviewRole = "Parent / Guardian" | "Student" | "Staff";

export interface CommunityReview {
  id: string;
  role: CommunityReviewRole;
  body: string;
}

export interface CommunityReviewsSummary {
  averageRating: number;
  reviews: CommunityReview[];
}

// ─── Mock data (single school) ─────────────────────────────────────────────────

export const COMMUNITY_REVIEWS_MOCK: CommunityReviewsSummary = {
  averageRating: 4.4,
  reviews: [
    {
      id: "1",
      role: "Parent / Guardian",
      body: "The principles and rest of the administration only seem to care about the reputation as a good school district and not about the children with needs.",
    },
    {
      id: "2",
      role: "Staff",
      body: "Strong collaboration among grade-level teams. Professional development is frequent and actually useful—rare in my experience.",
    },
    {
      id: "3",
      role: "Student",
      body: "Most teachers want you to succeed. Clubs and sports are easy to join if you ask. The building could use better air conditioning in the summer.",
    },
    {
      id: "4",
      role: "Parent / Guardian",
      body: "Communication improved a lot this year. I get weekly updates and know who to email when something comes up. Wish bus routes were a bit more predictable.",
    },
    {
      id: "5",
      role: "Staff",
      body: "Workload is heavy but manageable. Leadership is approachable and listens when we raise concerns about student safety or scheduling.",
    },
    {
      id: "6",
      role: "Student",
      body: "The counseling office helped me figure out my schedule and dual-enrollment options. Lunch lines are long on pizza day.",
    },
    {
      id: "7",
      role: "Parent / Guardian",
      body: "My child needed a 504 plan; the process took longer than we hoped, but once in place the accommodations have been consistent.",
    },
    {
      id: "8",
      role: "Staff",
      body: "Resources for students with disabilities are stretched. We do our best with the team we have; another specialist would make a big difference.",
    },
    {
      id: "9",
      role: "Student",
      body: "I feel safe here. Teachers hold high expectations and will stay after school if you need help. The library is my favorite spot.",
    },
    {
      id: "10",
      role: "Parent / Guardian",
      body: "We chose this school for the arts program and have not been disappointed. Performances are excellent and inclusive of all skill levels.",
    },
  ],
};

// ─── Stars (overall average only) ───────────────────────────────────────────────

function OverallStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center gap-0.5", className)}
      aria-label={`${rating.toFixed(1)} out of 5 stars average`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <div key={i} className="relative h-6 w-6 shrink-0">
            <Star className="absolute inset-0 h-6 w-6 text-white/25" strokeWidth={1.5} fill="currentColor" />
            <div className="absolute inset-0 overflow-hidden text-amber-300" style={{ width: `${fill * 100}%` }}>
              <Star className="h-6 w-6 shrink-0" strokeWidth={0} fill="currentColor" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── View ─────────────────────────────────────────────────────────────────────

export interface CommunityReviewsViewProps {
  /** When omitted, mock data is shown. */
  data?: CommunityReviewsSummary | null;
}

export function CommunityReviewsView({ data }: CommunityReviewsViewProps) {
  const summary = data ?? COMMUNITY_REVIEWS_MOCK;
  const count = summary.reviews.length;
  const avg = summary.averageRating;

  return (
    <div className="space-y-4" data-testid="community-reviews-view">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-center text-lg font-bold text-slate-800 tracking-tight">Community Reviews</h2>
        </div>
        <div className="px-5 pb-5 flex justify-center">
          <div className="rounded-xl bg-slate-800 text-white px-10 py-6 text-center shadow-sm max-w-md w-full">
            <div className="text-4xl font-bold tabular-nums leading-none">{avg.toFixed(1)}</div>
            <OverallStars rating={avg} className="mt-3" />
            <div className="text-sm text-white/90 mt-3 font-medium">
              {count} {count === 1 ? "review" : "reviews"}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col max-h-[min(520px,55vh)]">
        <div className="overflow-y-auto p-5 space-y-4">
          {summary.reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3 space-y-2"
              data-testid={`community-review-${r.id}`}
            >
              <div className="text-xs font-bold text-gray-800 uppercase tracking-wide">{r.role}</div>
              <p className="text-sm text-gray-800 leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CommunityReviewsView;

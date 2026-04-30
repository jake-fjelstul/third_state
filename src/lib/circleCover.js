const COVER_LOOKUP = {
  'from-indigo-500 via-sky-500 to-emerald-400': 'linear-gradient(135deg, #6366F1 0%, #0EA5E9 50%, #34D399 100%)',
  'from-indigo-500 via-purple-500 to-indigo-500': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #6366F1 100%)',
  'from-rose-500 via-pink-500 to-orange-400': 'linear-gradient(135deg, #F43F5E 0%, #EC4899 50%, #FB923C 100%)',
  'from-teal-500 via-cyan-500 to-sky-500': 'linear-gradient(135deg, #14B8A6 0%, #06B6D4 50%, #0EA5E9 100%)',
  'from-amber-500 via-orange-500 to-rose-500': 'linear-gradient(135deg, #F59E0B 0%, #F97316 50%, #F43F5E 100%)',
}

const DEFAULT_COVER = 'linear-gradient(160deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)'

export function resolveCircleCover(circle) {
  if (circle?.coverImageUrl) return { kind: 'image', url: circle.coverImageUrl }
  return {
    kind: 'gradient',
    value: COVER_LOOKUP[circle?.coverGradient] || DEFAULT_COVER,
  }
}

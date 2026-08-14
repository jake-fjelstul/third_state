import { circleIconComponent } from '../../lib/circleIcons'

export default function CircleIcon({ circle, size = 20, color = 'currentColor', strokeWidth = 2, style }) {
  const Comp = circleIconComponent(circle)
  return <Comp size={size} color={color} strokeWidth={strokeWidth} style={style} aria-hidden="true" />
}

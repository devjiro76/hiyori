interface SpeechBubbleProps {
  text: string
  durationSeconds: number
}

export function SpeechBubble({ text, durationSeconds }: SpeechBubbleProps) {
  return (
    <div
      className="speech-bubble"
      style={{ animationDuration: `${durationSeconds}s` }}
    >
      {text}
    </div>
  )
}

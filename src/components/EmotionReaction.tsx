interface EmotionReactionProps {
  symbol: string
}

export function EmotionReaction({ symbol }: EmotionReactionProps) {
  return (
    <div className="emotion-reaction">
      {symbol}
    </div>
  )
}

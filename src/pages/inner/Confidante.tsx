import ChatPanel from '../../components/ChatPanel'
import { CONFIDANTE_MODES } from '../../data/content'
import { Chip } from '../../components/ui'

export default function Confidante() {
  return (
    <>
      <ChatPanel
        kind="confidante"
        title="A quiet conversation"
        placeholder="What’s on your heart today?"
        newConversationDefaults={() => ({ mode: 'talk' })}
        emptyTitle="Talk about anything"
        emptyBody="Emotions, relationships, stress, decisions, wins — choose how you’d like to be met, then begin."
        renderSetup={(conv, update) => (
          <div>
            <div className="flex flex-wrap gap-1.5">
              {CONFIDANTE_MODES.map((m) => <Chip key={m.key} active={(conv?.mode ?? 'talk') === m.key} onClick={() => update({ mode: m.key })}>{m.label}</Chip>)}
            </div>
            <p className="mt-2 text-[12.5px] text-taupe-deep">{CONFIDANTE_MODES.find((m) => m.key === (conv?.mode ?? 'talk'))?.hint}</p>
          </div>
        )}
      />
      <p className="mt-6 max-w-3xl text-[12.5px] leading-relaxed text-taupe-deep">
        When an AI model is connected, your confidante is designed to be warm, curious and honest — supportive without simply agreeing, and willing to gently challenge you.
        It is not a therapist, won’t diagnose, and will encourage real-world support. If you are in crisis or thinking about harming yourself, please contact local emergency services
        or a crisis line (in the US, call or text 988).
      </p>
    </>
  )
}

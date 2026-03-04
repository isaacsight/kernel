import { motion, AnimatePresence } from 'motion/react'
import { SPRING, TRANSITION } from '../constants/motion'
import { IconMic, IconClose } from './KernelIcons'

type LoopState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface VoiceLoopOverlayProps {
  isActive: boolean
  state: LoopState
  transcript: string
  onStop: () => void
}

export function VoiceLoopOverlay({ isActive, state, transcript, onStop }: VoiceLoopOverlayProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="ka-voice-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION.OVERLAY}
        >
          <motion.div
            className="ka-voice-overlay-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ ...SPRING.DEFAULT }}
          >
            {/* Animated state indicator */}
            <div className={`ka-voice-indicator ka-voice-indicator--${state}`}>
              {state === 'listening' && (
                <motion.div
                  className="ka-voice-rings"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="ka-voice-ring" />
                  <div className="ka-voice-ring ka-voice-ring--2" />
                  <div className="ka-voice-ring ka-voice-ring--3" />
                </motion.div>
              )}
              {state === 'thinking' && (
                <motion.div
                  className="ka-voice-pulse"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.4, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {state === 'speaking' && (
                <div className="ka-voice-bars">
                  {[0, 1, 2, 3, 4].map(i => (
                    <motion.div
                      key={i}
                      className="ka-voice-bar"
                      animate={{ scaleY: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
                    />
                  ))}
                </div>
              )}
              <div className="ka-voice-icon">
                <IconMic size={32} />
              </div>
            </div>

            {/* State label */}
            <motion.p
              className="ka-voice-label"
              key={state}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={TRANSITION.MESSAGE}
            >
              {state === 'listening' && 'Listening...'}
              {state === 'thinking' && 'Thinking...'}
              {state === 'speaking' && 'Speaking...'}
            </motion.p>

            {/* Live transcript */}
            {transcript && state === 'listening' && (
              <motion.p
                className="ka-voice-transcript"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
              >
                {transcript}
              </motion.p>
            )}

            {/* Dismiss button */}
            <button className="ka-voice-dismiss" onClick={onStop} aria-label="End voice conversation">
              <IconClose size={24} />
            </button>

            <p className="ka-voice-hint">Tap anywhere or say "stop" to end</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

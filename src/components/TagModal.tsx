import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { SPRING } from '../constants/motion'
import { IconClose } from './KernelIcons'
import { useDragControls } from 'framer-motion'

const SUGGESTED_TAGS = ['Work', 'Personal', 'Research', 'Ideas', 'Important']

interface TagModalProps {
  isOpen: boolean
  onClose: () => void
  currentTags: string[]
  onSave: (tags: string[]) => void
}

export function TagModal({ isOpen, onClose, currentTags, onSave }: TagModalProps) {
  const { t } = useTranslation('common')
  const [tags, setTags] = useState<string[]>(currentTags)
  const [newTag, setNewTag] = useState('')
  const dragControls = useDragControls()

  if (!isOpen) return null

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const addCustomTag = () => {
    const trimmed = newTag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed])
      setNewTag('')
    }
  }

  return (
    <>
      <motion.div
        className="ka-more-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-tag-modal"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 300) onClose()
        }}
      >
        <div className="ka-more-drag-handle" onPointerDown={(e) => dragControls.start(e)} />
        <div className="ka-tag-modal-header">
          <span className="ka-tag-modal-title">{t('tags.title')}</span>
          <button className="ka-sheet-close-btn" onClick={onClose} aria-label={t('close')}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="ka-tag-modal-suggested">
          <span className="ka-tag-modal-label">{t('tags.suggested')}</span>
          <div className="ka-tag-modal-pills">
            {SUGGESTED_TAGS.map(tag => (
              <button
                key={tag}
                className={`ka-tag-pill${tags.includes(tag) ? ' ka-tag-pill--active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {tags.filter(t => !SUGGESTED_TAGS.includes(t)).length > 0 && (
          <div className="ka-tag-modal-custom">
            {tags.filter(t => !SUGGESTED_TAGS.includes(t)).map(tag => (
              <button
                key={tag}
                className="ka-tag-pill ka-tag-pill--active"
                onClick={() => toggleTag(tag)}
              >
                {tag} &times;
              </button>
            ))}
          </div>
        )}

        <form className="ka-tag-modal-input-row" onSubmit={(e) => { e.preventDefault(); addCustomTag() }}>
          <input
            className="ka-tag-modal-input"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            placeholder={t('tags.addTag')}
            maxLength={30}
          />
        </form>

        <button className="ka-tag-modal-save" onClick={() => { onSave(tags); onClose() }}>
          {t('tags.save')}
        </button>
      </motion.div>
    </>
  )
}

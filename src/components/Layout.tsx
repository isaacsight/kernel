import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION } from '../constants/motion'

export function Layout() {
  const location = useLocation()

  return (
    <div className="site-wrapper">
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.QUICK }}
          className="site-main"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  )
}

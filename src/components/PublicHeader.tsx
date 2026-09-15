import { Link } from 'react-router-dom'
import { Languages } from 'lucide-react'
import { useLang } from '@/i18n'
import { Logo } from './Logo'
import { Button, Container } from './ui'

export function PublicHeader() {
  const { t, toggle, lang } = useLang()
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] glass">
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-label="language"
            className="gap-1.5"
          >
            <Languages className="h-4 w-4" />
            {lang === 'ar' ? 'EN' : 'ع'}
          </Button>
          <Link to="/login">
            <Button variant="outline" size="sm">
              {t('nav.login')}
            </Button>
          </Link>
          <Link to="/take" className="hidden sm:block">
            <Button variant="primary" size="sm">
              {t('nav.takeSurvey')}
            </Button>
          </Link>
        </nav>
      </Container>
    </header>
  )
}

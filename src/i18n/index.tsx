import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ar, type Dict } from './ar'
import { en } from './en'

type Lang = 'ar' | 'en'
const DICTS: Record<Lang, Dict> = { ar, en }

interface LangCtx {
  lang: Lang
  dir: 'rtl' | 'ltr'
  setLang: (l: Lang) => void
  toggle: () => void
  t: (path: string) => string
  dict: Dict
}

const Ctx = createContext<LangCtx | null>(null)

function lookup(obj: unknown, path: string): string {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return path
    }
  }
  return typeof cur === 'string' ? cur : path
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('kku_lang') as Lang) || 'ar'
    } catch {
      return 'ar'
    }
  })

  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    try {
      localStorage.setItem('kku_lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang, dir])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const toggle = useCallback(() => setLangState((l) => (l === 'ar' ? 'en' : 'ar')), [])
  const t = useCallback((path: string) => lookup(DICTS[lang], path), [lang])

  const value = useMemo<LangCtx>(
    () => ({ lang, dir, setLang, toggle, t, dict: DICTS[lang] }),
    [lang, dir, setLang, toggle, t],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}

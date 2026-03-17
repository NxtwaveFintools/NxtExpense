import { AppHeader } from '@/components/ui/app-header'
import { PageTransition } from '@/components/ui/page-transition'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <PageTransition>{children}</PageTransition>
    </>
  )
}

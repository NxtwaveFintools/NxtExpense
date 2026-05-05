import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Admin Designations' }

export default async function AdminDesignationsPage() {
  redirect('/admin')
}

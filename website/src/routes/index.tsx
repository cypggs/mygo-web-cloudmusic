import { createFileRoute } from '@tanstack/solid-router'
import { MusicApp } from '../components/MusicApp'

export const Route = createFileRoute('/')({
  component: MusicApp,
})

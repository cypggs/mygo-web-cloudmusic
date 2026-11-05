import { Show, createEffect, createSignal } from 'solid-js'
import { Icon } from './Icon'

export function Artwork(props: {
  src?: string
  alt?: string
  class?: string
  round?: boolean
  eager?: boolean
}) {
  const [failed, setFailed] = createSignal(false)
  createEffect(() => { props.src; setFailed(false) })
  return (
    <div class={`artwork ${props.class ?? ''}`} classList={{ round: props.round }}>
      <Show when={props.src && !failed()} fallback={<Icon name="music" size={22} />}>
        <img
          src={props.src}
          alt={props.alt || ''}
          loading={props.eager ? 'eager' : 'lazy'}
          draggable={false}
          onError={() => setFailed(true)}
        />
      </Show>
    </div>
  )
}

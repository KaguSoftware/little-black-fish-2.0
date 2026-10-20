# Product

## Register

brand

## Users

Studio commissioners, festival programmers, collaborators and fans of the animation studio **Little Black Fish**. They arrive from a link (a festival listing, a DM, a credit), usually on a laptop in the evening, sometimes on a phone. They decide in under thirty seconds whether this world has a pull. They are not here to complete a task; they are here to be drawn in, and then to find the series and the rest of the work.

## Product Purpose

A portfolio site for Little Black Fish whose featured project is an animated series. The home page makes the studio's world felt and sends people into the series with one strong invitation. The series page (`/projects/series`) is one continuous 3D scene in which the series' six characters each tell the same story from their own side; visitors can switch teller at any moment without losing their place. The archive (`/projects`) holds the rest of the work.

Success: a visitor watches without touching for longer than they meant to, switches teller at least once, and clicks through to watch the series or contact the studio.

## Brand Personality

**Ritual, hushed, carved.** Theatrical and a little uncanny, like a masked play staged in an abandoned stone hall at the edge of the mountains. Warm under the strangeness: the characters speak in first person, with humour. The interface stays quiet so the world can be loud. Emotional goals: curiosity, a held breath, then delight.

## Anti-references

- Neon-on-black "creative developer" portfolios: glowing cyan gradients, glitch text, cursor trails for their own sake.
- Editorial-magazine layouts: italic display serifs, ruled columns, small tracked mono labels everywhere.
- SaaS landing patterns: hero metrics, identical icon-card grids, glassmorphism panels.
- Generic 3D showcase sites where the model spins on a turntable with no story.

## Design Principles

1. **The world tells it, the UI whispers.** Controls are always reachable but never compete with the stage.
2. **One story, many truths.** Every system (camera, colour, particles, type) changes with the teller, so switching feels like changing who is speaking, not changing a theme.
3. **Watchable without touching.** Every page plays itself when idle; interaction adds to the show but is never required.
4. **Every motion belongs to someone.** Motion expresses a character's mood or the studio's voice; nothing animates just to decorate.
5. **Theatre, not tech demo.** Light comes from somewhere, darkness is a material, and transitions behave like stage craft (iris, spotlight, curtain).

## Accessibility & Inclusion

- WCAG 2.2 AA contrast for all text, including narration over the 3D scene.
- `prefers-reduced-motion`: no camera shake, no dive, no autoplay; crossfades replace travel.
- A visible pause control for ambient motion on every page.
- Teller switching and all navigation fully keyboard reachable with visible focus.
- Animated narration is exposed as complete text via `aria-label`; decorative letters are `aria-hidden`.
- Never rely on accent colour alone to signal the current teller (name and pressed state too).

import { Calculator } from './components/Calculator'
import { Docs } from './components/Docs'

// The calculator comes first in the DOM so screen readers and Tab reach it
// first. On wide screens the grid moves it to the right of the docs.
export function App() {
  return (
    <main className="mx-auto max-w-[1160px] lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 lg:px-8">
      <div className="lg:sticky lg:top-0 lg:col-start-2 lg:row-start-1 lg:self-start">
        <Calculator />
      </div>
      <div className="mx-auto w-full max-w-[calc(68ch+32px)] border-t border-hairline px-4 pt-8 pb-16 lg:col-start-1 lg:row-start-1 lg:mx-0 lg:max-w-none lg:border-t-0 lg:px-0 lg:pt-14">
        <Docs />
      </div>
    </main>
  )
}

import React, { Component } from "react";

export default class SurfaceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Customer surface render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-[#08090b] p-6 text-center text-white">
        <section className="max-w-xl border border-red-400/25 bg-[#111418] p-7">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff655a]">Page interrupted</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em]">We couldn&apos;t finish loading this page.</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-400">Refresh once to reconnect to the live inventory. If it continues, use the link below.</p>
          <a href="/" className="mt-6 inline-flex min-h-12 items-center bg-[#ef4538] px-6 text-sm font-black">
            Return to 604 Sell Cars
          </a>
        </section>
      </main>
    );
  }
}

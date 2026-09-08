# `app/` — the campaign dashboard

The React + Vite + Tailwind v4 source for `index.html`, built on
[shadcn/ui](https://ui.shadcn.com). Everything about it — why it exists, how it
shares state with the vanilla pages, and why its build output is committed — is
in the repository README under **Building the dashboard**.

```
npm install
npm run dev      # dev server
npm run build    # writes ../assets/dashboard/dashboard.{js,css}
npm run lint
```

`npx shadcn@latest add <component>` writes into `src/components/ui/`.

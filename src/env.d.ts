declare module 'alpinejs' {
  const Alpine: any;
  export default Alpine;
}

declare module '@alpinejs/collapse';

interface Window {
  Alpine: import('alpinejs').Alpine;
}

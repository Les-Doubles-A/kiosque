// Service worker minimal et sans état : ouvre la page « Actualités » au clic sur l'icône.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/news.html") });
});

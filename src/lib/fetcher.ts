// SWR fetcher with auth cookie auto-included
export const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json().then((data) => {
      if (!data.success) throw new Error(data.message || "API Error");
      return data.data;
    });
  });

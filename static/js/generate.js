// generate.js - sends the form to the server and shows the download link.

const form = document.getElementById("token-form");
const message = document.getElementById("form-message");
const result = document.getElementById("result");

form.addEventListener("submit", async (event) => {
  event.preventDefault();          // stop the normal page reload
  message.textContent = "Generating your token…";
  result.classList.add("hidden");

  const payload = Object.fromEntries(new FormData(form).entries());

  const res = await fetch("/api/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!res.ok) {
    message.textContent = "" + data.error;
    return;
  }

  message.textContent = "";
  document.getElementById("token-id").textContent = data.id;
  const link = document.getElementById("download-link");
  link.href = data.download_url;
  link.textContent = `Download ${data.file_name}`;
  result.classList.remove("hidden");
});

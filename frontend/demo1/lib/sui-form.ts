/**
 * Client-side: create and auto-submit a hidden form to SUI Payment page.
 * SUI uses Link-type redirect - user is sent to PV-Pay's hosted payment form.
 */
export function submitSuiForm(
  formUrl: string,
  fields: Record<string, string>
) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = formUrl;
  form.style.display = "none";

  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

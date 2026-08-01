export const FLOW_JSON_VERSION = "7.3";
export const FLOW_DATA_API_VERSION = "3.0";

export const FLOW_CATEGORIES = [
  "SIGN_UP",
  "SIGN_IN",
  "APPOINTMENT_BOOKING",
  "LEAD_GENERATION",
  "CONTACT_US",
  "CUSTOMER_SUPPORT",
  "SURVEY",
  "OTHER",
] as const;

export type FlowCategory = (typeof FLOW_CATEGORIES)[number];

export type FlowComponent = {
  type: string;
  name?: string;
  text?: string | string[];
  label?: string;
  children?: FlowComponent[];
  [key: string]: unknown;
};

export type FlowScreen = {
  id: string;
  title?: string;
  terminal?: boolean;
  success?: boolean;
  sensitive?: string[];
  data?: Record<string, unknown>;
  layout: {
    type: "SingleColumnLayout" | string;
    children: FlowComponent[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type FlowJson = {
  version: string;
  data_api_version?: string;
  routing_model?: Record<string, string[]>;
  screens: FlowScreen[];
  [key: string]: unknown;
};

export type FlowValidationIssue = {
  path: string;
  message: string;
  severity: "error" | "warning";
};

export function emptyFlowJson(): FlowJson {
  return {
    version: FLOW_JSON_VERSION,
    screens: [
      {
        id: "CONTACT",
        title: "Contact us",
        terminal: true,
        layout: {
          type: "SingleColumnLayout",
          children: [
            { type: "TextHeading", text: "How can we help?" },
            {
              type: "Form",
              name: "contact_form",
              children: [
                { type: "TextInput", name: "name", label: "Name", required: true, "input-type": "text" },
                { type: "TextInput", name: "email", label: "Email", required: true, "input-type": "email" },
                { type: "TextArea", name: "message", label: "Message", required: true },
                {
                  type: "Footer",
                  label: "Submit",
                  "on-click-action": {
                    name: "complete",
                    payload: {
                      name: "${form.name}",
                      email: "${form.email}",
                      message: "${form.message}",
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

export const FLOW_COMPONENTS = [
  "TextHeading", "TextSubheading", "TextBody", "TextCaption", "RichText", "Image", "EmbeddedLink",
  "TextInput", "TextArea", "CheckboxGroup", "RadioButtonsGroup", "Dropdown", "OptIn", "DatePicker",
  "CalendarPicker", "PhotoPicker", "DocumentPicker", "Form", "Footer", "If", "Switch",
] as const;

export function componentLabel(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function defaultComponent(type: string, index: number): FlowComponent {
  const name = `${type.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${index}`;
  switch (type) {
    case "TextHeading": return { type, text: "Heading" };
    case "TextSubheading": return { type, text: "Subheading" };
    case "TextBody": return { type, text: "Helpful information" };
    case "TextCaption": return { type, text: "Caption" };
    case "RichText": return { type, text: ["# Heading", "Add rich text here."] };
    case "Image": return { type, src: "", width: 100, height: 100, "scale-type": "contain" };
    case "EmbeddedLink": return { type, text: "Learn more", "on-click-action": { name: "open_url", url: "https://example.com" } };
    case "TextInput": return { type, name, label: "Question", required: false, "input-type": "text" };
    case "TextArea": return { type, name, label: "Long answer", required: false };
    case "CheckboxGroup": return { type, name, label: "Choose options", required: false, "data-source": [{ id: "option_1", title: "Option 1" }] };
    case "RadioButtonsGroup": return { type, name, label: "Choose one", required: false, "data-source": [{ id: "option_1", title: "Option 1" }] };
    case "Dropdown": return { type, name, label: "Choose one", required: false, "data-source": [{ id: "option_1", title: "Option 1" }] };
    case "OptIn": return { type, name, label: "I agree", required: true };
    case "DatePicker": return { type, name, label: "Choose a date", required: false };
    case "CalendarPicker": return { type, name, label: "Choose dates", mode: "single", required: false };
    case "PhotoPicker": return { type, name, label: "Add photos", "photo-source": "camera_gallery", "max-file-size-kb": 10240, "max-uploaded-photos": 1 };
    case "DocumentPicker": return { type, name, label: "Add a document", "max-file-size-kb": 10240, "max-uploaded-documents": 1 };
    case "Form": return { type, name, children: [] };
    case "Footer": return { type, label: "Continue", "on-click-action": { name: "complete", payload: {} } };
    case "If": return { type, condition: true, then: [], else: [] };
    case "Switch": return { type, value: "", cases: {}, default: [] };
    default: return { type };
  }
}

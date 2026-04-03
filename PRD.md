# MSG91 Email Sender Dashboard - Product Requirements Document (PRD)

## 1. Project Overview
The **MSG91 Email Sender Dashboard** is a streamlined, browser-based web application designed to dispatch bulk and individual emails using the MSG91 API. The project features a user-friendly frontend dashboard and relies on a Node.js proxy server to securely handle API requests and bypass frontend Cross-Origin Resource Sharing (CORS) restrictions. 

## 2. Core Features
The application provides a clean single-page interface segregated into four main tabs:

### 2.1 Settings
- **Authentication:** Input the MSG91 Auth Key securely (located in MSG91 Dashboard → API Keys).
- **Domain Configuration:** Specify the sender domain (must be pre-verified in MSG91 Email → Domains).
- **Sender Information:** Define "Sender Name" and "Sender Email" (e.g., `no-reply@yourdomain.com`).
- **Template Management:** Input the specific MSG91 Template ID pre-approved on the MSG91 platform.
- **Template Variables:** Support for defining dynamic MSG91 variables (e.g., `UserName`, `CompanyName`) to personalize emails at scale.

### 2.2 Manage Recipients
- **Manual Entry:** Add recipients individually by specifying Name, Email, and necessary template variables.
- **CSV Data Import:** Add bulk recipients by uploading a `.csv` file.
- **Manual CSV Paste:** Input user data through direct pasting of CSV-formatted text.
- **Recipient Management:** Select, deselect, clear all, and review users added to the pipeline.

### 2.3 Send Emails
Users can view sending statistics (Total Recipients, Template, Domain) and trigger dispatches using three targeted modes:
- **Bulk Send (Send All):** Dispatches all emails simultaneously via a single MSG91 batch API request.
- **Sequential Send (One-by-One):** Iterates through the recipient list individually with a configurable time delay (in seconds) between each dispatch. This prevents rate limiting scenarios.
- **Individual Send:** Dropdown to select a single recipient for highly targeted testing or one-off messages.
- **API Request Preview:** View real-time previews of the outgoing JSON payload mimicking the MSG91 API format.

### 2.4 Status & Logs
- **Analytics Dashboard:** Graphical widgets highlighting Total Sent, Successful, Failed, and Pending dispatch statuses.
- **Activity Log Table:** Detailed tabular views logging Time, Recipient, Email, Status, and MSG91 API Response.
- **Exporting Data:** Export dispatch logs as a CSV file to evaluate campaign success. Includes filtering by active states (Success, Failed, Pending).

## 3. Technical Architecture
The application is a functional Single Page Application (SPA), operating natively through a custom local Node.js proxy.

### 3.1 Frontend (`index.html`, `app.js`, `style.css`)
- Pure HTML structure mapped to a responsive, modern aesthetic.
- The UI contains zero remote framework requirements (Vanilla JS & CSS).

### 3.2 Backend Service (`proxy.js`)
- Runs a lightweight Node.js HTTP Server (`localhost:3091`).
- **CORS Bypass:** Eliminates frontend browser-to-API restrictions by funneling all requests through localhost.
- **Static File Serving:** Serves HTML, CSS, and JS SPA assets so the application runs perfectly out-of-the-box.
- **MSG91 Endpoint Mapping:** Listens to `POST /api/v5/email/send` and proxies the exact payload + headers (including the all-important `authkey`) natively to `control.msg91.com/api/v5/email/send`.

## 4. Setup & Execution Requirements

### 4.1 Prerequisites
- **Node.js** installed on your workstation.
- An active MSG91 Account with verified Email domains and an approved Auth Key.
- Email services explicitly enabled in the MSG91 dashboard.

### 4.2 Starting The Application
Run the proxy file server via Node:
```bash
node proxy.js
```
The application will automatically be served at: `http://localhost:3091`

### 4.3 Resolving MSG91 API IP Whitelist Errors (Error 418)
To prevent unauthorized use, MSG91 strictly enforces IP whitelisting for its APIs:
1. When `proxy.js` starts, it automatically queries `api.ipify.org` to detect and broadcast your current **Public IP** inside the terminal.
2. If you try to send an email and the API returns **status `401` / `apiError: 418`**, the terminal will flag this as an **IP WHITELIST ERROR**.
3. **The Fix:**
   - Log into your MSG91 Dashboard.
   - Navigate to **Profile → API → Whitelist IPs** (or Settings → Security).
   - Add the **Public IP** broadcasted in your node terminal.
   - Save the changes and retry the email ping.

# MVP 03 Partner Access

<table id="bkmrk-product-release-stat"><thead><tr><th>Product</th><th>Release</th><th>Status</th><th>Version</th></tr></thead><tbody><tr><td>Ticket D-Saster</td><td>MVP</td><td>Draft</td><td>1.0</td></tr></tbody></table>

---

## 1. Feature description

This feature provides account registration and sign-in for the platform's partners. Registration is by invitation only. It involves three actors:

- **D-Saster Staff** generates an invitation for a specific role (Venue Owner or Organizer) and hands the resulting invitation code to the partner.
- **Venue Owner** and **Organizer** register an account by providing a username, a password and their invitation code, and afterwards sign in with their username and password.

Once signed in, a partner can access the Backstage (the partner area of the platform) and perform the actions allowed for their role, as defined in [MVP 01](https://gateway.tail9a6ddb.ts.net/bookstack/books/prds/page/mvp-01-venue-and-event-registration "MVP 01 Venue and Event Registration").

## 2. Goal

Ensure that only invited partners can register and act on the platform, and that every partner action is attributable to an identified account with a single, defined role.

The feature is complete when staff can invite a venue owner and an organizer, both can register and sign in, and each can reach only the Backstage actions allowed for their role.

## 3. Requirement breakdown

<table id="bkmrk-id-requirement-accep" style="width: 100%;"><thead><tr><th style="width: 9.64794%;">ID</th><th style="width: 24.791%;">Requirement</th><th style="width: 65.5412%;">Acceptance criteria</th></tr></thead><tbody><tr><td style="width: 9.64794%;">PA-01</td><td style="width: 24.791%;">Staff can generate an invitation for a given role.</td><td style="width: 65.5412%;">1. The request specifies the role, Venue Owner or Organizer. The response returns an invitation code.  
2. Every invitation code generated is unique.  
3. Generation is available through a programmatic interface. No screen is provided.  
4. Generation requires a staff credential. Requests without a valid staff credential are rejected.</td></tr><tr><td style="width: 9.64794%;">PA-02</td><td style="width: 24.791%;">A partner can register an account using an invitation code.</td><td style="width: 65.5412%;">1. Registration requests a username, a password and an invitation code. All three are mandatory.  
2. A registration with an invitation code that does not exist is rejected.  
3. On success, the account is created and the partner is informed that they can sign in.</td></tr><tr><td style="width: 9.64794%;">PA-03</td><td style="width: 24.791%;">An invitation code can be used only once.</td><td style="width: 65.5412%;">1. A code that has been used in a successful registration is rejected on any later attempt.  
2. A registration attempt that fails for another reason (for example, the username is already taken) does not consume the code.</td></tr><tr><td style="width: 9.64794%;">PA-04</td><td style="width: 24.791%;">The account's role is determined by the invitation.</td><td style="width: 65.5412%;">1. The role of the new account is the role specified in the invitation.  
2. The registration form does not offer a choice of role.  
3. Each account has exactly one role.</td></tr><tr><td style="width: 9.64794%;">PA-05</td><td style="width: 24.791%;">Usernames are unique.</td><td style="width: 65.5412%;">1. A registration with a username that already belongs to an account is rejected, informing the partner that the username is not available.</td></tr><tr><td style="width: 9.64794%;">PA-06</td><td style="width: 24.791%;">Passwords meet a minimum standard and are protected.</td><td style="width: 65.5412%;">1. A password shorter than 8 characters is rejected.  
2. The password is never stored in readable form.</td></tr><tr><td style="width: 9.64794%;">PA-07</td><td style="width: 24.791%;">A registered partner can sign in.</td><td style="width: 65.5412%;">1. Signing in with a correct username and password gives access to the Backstage.  
2. Signing in with incorrect credentials is rejected with a message that does not reveal whether the username or the password was wrong.</td></tr><tr><td style="width: 9.64794%;">PA-08</td><td style="width: 24.791%;">A signed-in partner carries a verifiable proof of identity.</td><td style="width: 65.5412%;">1. Successful sign-in issues a token that identifies the partner and their role.  
2. Any component of the system that receives the token can verify that it was issued by the platform and has not been altered.  
3. The token expires 8 hours after it is issued. Requests made with an expired token are rejected, and the partner must sign in again.</td></tr><tr><td style="width: 9.64794%;">PA-09</td><td style="width: 24.791%;">Backstage access is restricted by role.</td><td style="width: 65.5412%;">1. A venue owner can reach only the venue registration actions.  
2. An organizer can reach only the event registration actions.  
3. The restriction is enforced by the system, not only by hiding options on the application screens (see VE-07).</td></tr><tr><td style="width: 9.64794%;">PA-10</td><td style="width: 24.791%;">A signed-in partner can sign out.</td><td style="width: 65.5412%;">1. After signing out, the Backstage no longer uses the partner's token, and the partner must sign in again to access it.</td></tr></tbody></table>

## 4. Out of scope

The following are explicitly excluded from the MVP:

- Fan accounts.
- Sending invitations by email or any other channel. Staff hand over the code directly.
- A staff screen for managing invitations, and revoking or expiring unused invitations.
- Password reset and recovery.
- Editing or deleting accounts.
- Accounts with more than one role.
- Sign-in through external identity providers (social login, SSO) and multi-factor authentication.
- Locking an account after repeated failed sign-in attempts.

## 5. Constraints

- The sign-in token defined in PA-08 is a JSON Web Token (JWT). The Backstage applications attach it to every request they make on the partner's behalf.
- The staff credential for PA-01 is supplied to the system through configuration, never written in source code.
- Passwords are stored using a one-way hashing algorithm designed for passwords.
- No external systems are used: no email provider and no external identity provider.

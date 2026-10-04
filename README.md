\# ✦ Past Me



> \*\*Past Me reminds. It never decides.\*\*



\*\*Past Me\*\* is a reflective journaling application that creates meaningful connections between your present thoughts and your past memories.



Instead of letting old journal entries disappear into a timeline, Past Me uses semantic matching to recognize when something you write today connects with something you wrote before.



When a meaningful connection is discovered, Past Me gently asks:



> \*\*“Something you wrote before connects with what you just shared. Would you like to hear from your past self?”\*\*



Past Me does not tell users what to think or what decision to make.



It simply brings back their own words.



\---



\# 💡 The Problem



People journal during important moments in their lives.



They write when they are:



\- Excited

\- Confused

\- Struggling

\- Making important decisions

\- Starting something new

\- Missing someone

\- Growing as a person



But after weeks, months, or years, those thoughts become buried inside old journal entries.



Traditional journaling applications are good at \*\*storing memories\*\*, but they rarely help users discover meaningful relationships between what they felt before and what they are experiencing now.



\*\*Past Me was built to create that connection.\*\*



\---



\# ✨ The Idea



Most applications think about connections as:



\*\*Person ↔ Person\*\*



Past Me explores a different kind of connection:



\## Present Self ↔ Past Self



When a user writes a new journal entry, Past Me analyzes the meaning of the journal and compares it with memories that the same user wrote in the past.



If meaningful connections are discovered, Past Me gives the user the choice to revisit them.



The application does not expose similarity percentages to the user.



It does not interpret the memory for them.



It does not tell them which version of themselves was correct.



Their own words remain at the center of the experience.



\---



\# 🚀 Features



\## 📝 Personal Journaling



Users can create and manage personal journal entries with:



\- Journal titles

\- Custom journal dates

\- Full journal content

\- Word count

\- Local draft saving

\- Writing prompts

\- Edit functionality

\- Delete functionality



\---



\## ✦ Past Me Connections



When a journal is saved, Past Me searches older memories for meaningful semantic relationships.



Past Me supports:



\- Semantic similarity

\- Whole-journal matching

\- Multi-topic detection

\- Sentence-level matching

\- Adjacent-sentence matching

\- Multiple past connections

\- Duplicate connection removal

\- Strongest-match ranking

\- Past-only retrieval



When something meaningful is discovered, the application displays:



> \*\*PAST ME FOUND SOMETHING\*\*



The user can choose whether they want to revisit the memory.



\---



\# ↔ Then → Now



Instead of having AI explain what a memory means, Past Me shows the user's own words.



\### THEN



What the user wrote in the past.



\### NOW



What the user is writing today.



This allows users to recognize changes, patterns, growth, and contradictions for themselves.



\---



\# 🧠 Semantic Matching



Past Me uses semantic embeddings rather than basic keyword matching.



For example:



\### Past



> I worked incredibly hard to get the opportunity to study in the United States. I was excited about starting a new chapter.



\### Present



> I keep wondering whether moving to the US was actually a good decision.



The two entries do not contain exactly the same words.



However, they discuss closely related ideas.



Past Me represents journal text using \*\*384-dimensional semantic embeddings\*\* and stores those embeddings in PostgreSQL using \*\*pgvector\*\*.



Vector similarity search is then used to discover related past memories.



\---



\# 🔍 Multi-Topic Journal Matching



One journal may contain several independent thoughts.



For example, someone could write about:



\- Moving to another country

\- Missing conversations with their parents

\- Concerns about their health



Comparing only the complete journal could cause smaller topics to be overlooked.



Past Me therefore analyzes:



1\. The complete journal

2\. Individual meaningful sentences

3\. Adjacent sentence groups



Results from these searches are combined.



Duplicate memories are removed, the strongest connections are ranked first, and up to several meaningful memories can be shown to the user.



\---



\# ⏳ Past-Only Matching



Past Me should never present a future journal as something written by the user's “past self.”



Therefore semantic retrieval only considers memories where:



```text

past\_memory.memory\_date < current\_memory.memory\_date

```



This rule is enforced during database vector retrieval.



\---



\# 🕰 Take Me Back



\*\*Take Me Back\*\* randomly opens one of the user's previous journal entries.



Sometimes reflection does not need a search query.



It just needs an old memory.



\---



\# ♡ Pocket Note



Pocket Note provides small, thoughtful messages such as:



> You don't need to have everything figured out today.



> Small progress is still progress.



> Some chapters make sense only after you leave them.



> Rest is part of moving forward.



Pocket Notes are intentionally separate from semantic Past Me connections.



They are never presented as something the user's past self wrote.



\---



\# 🔎 Journal Search



Users can search their journal history using ordinary title and content search.



This makes it easy to locate a specific journal without affecting the semantic Past Me system.



\---



\# 📅 Journal Organization



Journal history is grouped by month in the sidebar.



Users can select previous entries and read, edit, rename, or delete them.



\---



\# 🔐 Authentication \& Privacy



Past Me uses \*\*Supabase Authentication\*\*.



Each journal is associated with the authenticated user's account.



Supabase Row Level Security helps ensure users can access only their own journal data.



\---



\# 🛠 Tech Stack



\## Frontend



\- React

\- TypeScript

\- Vite

\- CSS



\## Backend



\- Python

\- FastAPI

\- Uvicorn



\## Database \& Authentication



\- Supabase

\- PostgreSQL

\- Supabase Auth

\- Row Level Security (RLS)



\## Semantic Search



\- Sentence Transformers

\- `all-MiniLM-L6-v2`

\- 384-dimensional embeddings

\- pgvector

\- PostgreSQL vector similarity search



\---



\# 🏗 Architecture



```text

&#x20;                        USER

&#x20;                          │

&#x20;                          ▼

&#x20;                ┌──────────────────┐

&#x20;                │  React Frontend  │

&#x20;                │ TypeScript/Vite  │

&#x20;                └────────┬─────────┘

&#x20;                         │

&#x20;            ┌────────────┴─────────────┐

&#x20;            │                          │

&#x20;            ▼                          ▼

&#x20;    ┌───────────────┐          ┌───────────────┐

&#x20;    │ FastAPI API   │          │ Supabase Auth │

&#x20;    │    Python     │          └───────────────┘

&#x20;    └───────┬───────┘

&#x20;            │

&#x20;            ▼

&#x20;    ┌───────────────────┐

&#x20;    │ Semantic Embedding│

&#x20;    │     Generation    │

&#x20;    └─────────┬─────────┘

&#x20;              │

&#x20;              ▼

&#x20;    ┌───────────────────┐

&#x20;    │     Supabase      │

&#x20;    │    PostgreSQL     │

&#x20;    │     pgvector      │

&#x20;    └───────────────────┘

```



\---



\# 📁 Project Structure



```text

Past-Me/

│

├── backend/

│   ├── main.py

│   ├── requirements.txt

│   └── .env                 # Local only - not committed

│

├── frontend/

│   ├── src/

│   │   ├── App.tsx

│   │   ├── App.css

│   │   └── lib/

│   │       └── supabase.ts

│   │

│   ├── package.json

│   ├── vite.config.ts

│   └── .env                 # Local only - not committed

│

├── .gitignore

│

└── README.md

```



\---



\# 💻 Running Past Me Locally



Past Me currently runs as a local development application.



You need to run both the \*\*FastAPI backend\*\* and the \*\*React frontend\*\*.



\---



\# 1. Clone the Repository



```bash

git clone https://github.com/pulagamsailaja/Past-Me.git

cd Past-Me

```



\---



\# 2. Backend Setup



Open a terminal and move into the backend:



```bash

cd backend

```



Create a Python virtual environment:



```bash

python -m venv venv

```



\### Windows PowerShell



Activate it using:



```powershell

.\\venv\\Scripts\\Activate.ps1

```



Install the dependencies:



```bash

pip install -r requirements.txt

```



\---



\# 3. Backend Environment Variables



Create a file named:



```text

backend/.env

```



Add:



```env

SUPABASE\_URL=your\_supabase\_project\_url

SUPABASE\_ANON\_KEY=your\_supabase\_publishable\_key

```



Use credentials from your own Supabase project.



\*\*Never commit `.env` files or private credentials to GitHub.\*\*



\---



\# 4. Start the Backend



From the `backend` directory:



```bash

uvicorn main:app --reload

```



The backend should start at:



```text

http://127.0.0.1:8000

```



FastAPI API documentation is available locally at:



```text

http://127.0.0.1:8000/docs

```



Keep this terminal running.



\---



\# 5. Frontend Setup



Open a \*\*second terminal\*\*.



From the Past-Me project directory:



```bash

cd frontend

```



Install frontend dependencies:



```bash

npm install

```



\---



\# 6. Frontend Environment Variables



Create:



```text

frontend/.env

```



Configure the Supabase variables expected by the frontend:



```env

VITE\_SUPABASE\_URL=your\_supabase\_project\_url

VITE\_SUPABASE\_ANON\_KEY=your\_supabase\_publishable\_key

```



\---



\# 7. Start the Frontend



Run:



```bash

npm run dev

```



Vite will display a local URL, normally:



```text

http://localhost:5173

```



Open that URL in your browser.



Past Me should now be running locally.



\---



\# ⚡ Quick Start for Existing Setup



If the repository and dependencies are already configured, only two terminals are required.



\## Terminal 1 — Backend



```powershell

cd C:\\Users\\pulag\\OneDrive\\Desktop\\Past-me\\backend

.\\venv\\Scripts\\Activate.ps1

uvicorn main:app --reload

```



Leave it running.



You should see output indicating that Uvicorn is running on:



```text

http://127.0.0.1:8000

```



\## Terminal 2 — Frontend



```powershell

cd C:\\Users\\pulag\\OneDrive\\Desktop\\Past-me\\frontend

npm run dev

```



Leave this terminal running too.



Then open:



```text

http://localhost:5173

```



\---



\# 🎬 Recommended Demo Flow



For a live demonstration:



1\. Start the backend.

2\. Start the frontend.

3\. Open Past Me.

4\. Log in.

5\. Show existing journal history.

6\. Open an older journal.

7\. Click \*\*+ New Journal\*\*.

8\. Write a journal that relates to an older memory.

9\. Save the journal.

10\. Show the \*\*Past Me Found Something\*\* notification.

11\. Click \*\*Read it / Read them\*\*.

12\. Demonstrate \*\*Then → Now\*\*.

13\. Navigate multiple connections with \*\*Previous / Next\*\*.

14\. Show \*\*Take Me Back\*\*.

15\. Show \*\*Pocket Note\*\*.



\---



\# 🧪 Example Semantic Demo



An older journal could contain:



> I worked incredibly hard to get the opportunity to study in the United States. I was excited about starting a new chapter.



Later, create a journal containing:



> Lately I've been wondering whether moving to the United States was actually the right decision for me.



Past Me should recognize the semantic relationship even though the wording is different.



For a multi-topic demonstration, a new journal could contain:



> Lately I've been wondering whether moving to the United States was actually the right decision for me.

>

> I've also been thinking about my parents and how much I miss having good conversations with them.

>

> At the same time, I've been worried about my health and how I have been feeling physically.



Past Me can identify different older memories related to these topics.



\---



\# 🔒 Security Notes



The repository does \*\*not\*\* include environment-variable files.



Developers must provide their own Supabase configuration.



Do not commit:



```text

.env

backend/.env

frontend/.env

venv/

node\_modules/

```



Never publish database passwords, service-role keys, or other private credentials.



\---



\# 🎯 Why Past Me Fits “Connections”



The hackathon theme is \*\*Connections\*\*.



Most applications interpret connection as:



```text

Person ↔ Person

```



Past Me explores:



```text

Present Self ↔ Past Self

```



Instead of introducing users to someone new, Past Me reconnects them with someone they already know but may have forgotten:



\*\*the person they used to be.\*\*



\---



\# 🔮 Future Improvements



Future versions of Past Me could include:



\- Production cloud deployment

\- Mobile application support

\- Connection timelines

\- Long-term reflection patterns

\- User-controlled semantic sensitivity

\- Journal export

\- Additional privacy controls

\- Improved semantic models

\- Personal reflection statistics



\---



\# 🧭 Design Philosophy



Past Me follows one central principle:



> ## Past Me reminds. It never decides.



The application does not tell users:



\- What decision they should make

\- Whether their previous opinion was correct

\- Whether they should stay or leave a situation

\- What their memories mean

\- How they should feel



It simply gives users access to their own previous thoughts at moments when those thoughts may be relevant again.



The interpretation belongs to the user.



\---



\# ✦ Past Me



\### Your past isn't gone. Sometimes, it just needs a way to find you again.



\*\*Past Me reminds. It never decides.\*\*


import { useState } from 'react';

function App() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <header>
        <h1>zvote — proto1</h1>
        <div className="header-right">
          <div className="identity">
            <span className="muted">You:</span>
            <code>test-user</code>
          </div>
        </div>
      </header>
      
      <main>
        <div className="panel">
          <h2>My votes</h2>
          <button onClick={() => setShowModal(true)}>+ Create vote</button>
          <p>No votes yet.</p>
        </div>
        
        <div className="panel">
          <h2>Public votes</h2>
          <p>No public votes.</p>
        </div>
      </main>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create a vote</h3>
              <button className="icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label>
                Vote title
                <input type="text" placeholder="Enter title..." />
              </label>
            </div>
            <div className="modal-footer">
              <button className="secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={() => setShowModal(false)}>Create</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

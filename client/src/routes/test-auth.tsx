import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { authService } from "@/lib/auth";
import { getSession } from "@/lib/auth-client";

export const Route = createFileRoute("/test-auth")({
  component: TestAuth,
});

function TestAuth() {
  const [sessionData, setSessionData] = useState<any>(null);
  const [directApiData, setDirectApiData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testAuth = async () => {
      try {
        console.log("Testing authentication...");
        
        // Test direct API call
        const directResponse = await fetch('http://localhost:3000/api/auth/get-session', {
          credentials: 'include'
        });
        const directData = await directResponse.json();
        setDirectApiData(directData);
        console.log("Direct API response:", directData);
        
        // Test Better Auth getSession
        const session = await getSession();
        setSessionData(session);
        console.log("Better Auth session:", session);
        
        // Test authService.getCurrentUser
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
        console.log("Current user:", user);
        
      } catch (error) {
        console.error("Auth test error:", error);
      } finally {
        setLoading(false);
      }
    };
    
    testAuth();
  }, []);

  if (loading) {
    return <div className="p-8">Loading auth test...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Test</h1>
      
      <div className="space-y-6">
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Direct API Response</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
            {JSON.stringify(directApiData, null, 2)}
          </pre>
        </div>
        
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Better Auth Session</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
            {JSON.stringify(sessionData, null, 2)}
          </pre>
        </div>
        
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Current User (authService)</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
            {JSON.stringify(currentUser, null, 2)}
          </pre>
        </div>
        
        <div className="mt-6">
          <button 
            onClick={() => window.location.href = '/login'}
            className="bg-blue-500 text-white px-4 py-2 rounded mr-4"
          >
            Go to Login
          </button>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
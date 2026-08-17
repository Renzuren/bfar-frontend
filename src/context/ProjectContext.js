import React, { createContext, useState, useContext, useCallback } from 'react';
import { api } from '../lib/apiMiddleware';
import { toast } from 'sonner';

const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (error) {
      toast.error('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProject = useCallback(async (id) => {
    try {
      const response = await api.get(`/projects/${id}`);
      setCurrentProject(response.data);
      return response.data;
    } catch (error) {
      toast.error('Failed to fetch project');
      return null;
    }
  }, []);

  const createProject = useCallback(async (data) => {
    try {
      const response = await api.post('/projects', data);
      toast.success('Project created successfully');
      setProjects((prev) => [response.data, ...prev]);
      return response.data;
    } catch (error) {
      toast.error('Failed to create project');
      return null;
    }
  }, []);

  const updateProject = useCallback(async (id, data) => {
    try {
      const response = await api.put(`/projects/${id}`, data);
      toast.success('Project updated successfully');
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? response.data : p))
      );
      if (currentProject?.id === id) setCurrentProject(response.data);
      return response.data;
    } catch (error) {
      toast.error('Failed to update project');
      return null;
    }
  }, [currentProject]);

  const deleteProject = useCallback(async (id) => {
    try {
      await api.delete(`/projects/${id}`);
      toast.success('Project deleted successfully');
      setProjects((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (error) {
      toast.error('Failed to delete project');
      return false;
    }
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        loading,
        fetchProjects,
        fetchProject,
        createProject,
        updateProject,
        deleteProject,
        setCurrentProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);

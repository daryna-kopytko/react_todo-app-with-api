/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { UserWarning } from './UserWarning';
import {
  USER_ID,
  deleteTodo,
  getTodos,
  updateTodo,
  uploadTodo,
} from './api/todos';
import { Todo } from './types/Todo';
import { TodoStatus } from './types/TodoStatus';
import { ErrorType } from './types/Errors';
import { Header } from './components/Header';
import { TodoList } from './components/TodoList';
import { Footer } from './components/Footer';
import { emptyTodo } from './utils/EmptyTodo';
import { ErrorNotification } from './components/ErrorNotification';
import { UpdateTodoData } from './types/UpdateTodoData';

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [todoTitle, setTodoTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedTodoStatus, setSelectedTodoStatus] = useState<TodoStatus>(
    TodoStatus.All,
  );
  const [errorMessage, setErrorMessage] = useState<ErrorType | ''>('');
  const [processingTodos, setProcessingTodos] = useState<number[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const focusInputField = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  useEffect(() => {
    getTodos()
      .then(setTodos)
      .catch(() => setErrorMessage(ErrorType.LOAD_TODOS));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setErrorMessage('');
    }, 3000);

    return () => clearTimeout(timer);
  }, [errorMessage]);

  useEffect(() => {
    focusInputField();
  }, [todoTitle, todos, selectedTodoStatus, isLoading]);

  const filteringTodosByActiveStatus = useMemo(
    () => [...todos].filter(todo => !todo.completed),
    [todos],
  );

  const filteringTodosByCompletedStatus = useMemo(
    () => [...todos].filter(todo => todo.completed),
    [todos],
  );

  const filteredTodos = useMemo(() => {
    switch (selectedTodoStatus) {
      case TodoStatus.Active:
        return filteringTodosByActiveStatus;

      case TodoStatus.Completed:
        return filteringTodosByCompletedStatus;

      default:
        return todos;
    }
  }, [
    filteringTodosByActiveStatus,
    filteringTodosByCompletedStatus,
    selectedTodoStatus,
    todos,
  ]);

  const changeTodoTitleHandler = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setErrorMessage('');
      setTodoTitle(e.target.value);
    },
    [],
  );

  const closeErrorHandler = () => {
    setErrorMessage('');
  };

  const handleStatusChange = (status: TodoStatus) => {
    setSelectedTodoStatus(status);
  };

  const selectedEditTodoId = (id: number | null) => {
    setEditingTodoId(id);
  };

  const updateProcessingTodos = (id: number) => {
    setProcessingTodos(prev => [...prev, id]);
  };

  const removeProcessingTodos = (id: number) => {
    setProcessingTodos(prev => prev.filter(prevItem => prevItem !== id));
  };

  const addTodo = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!todoTitle.trim().length) {
        setErrorMessage(ErrorType.EMPTY_TITLE);

        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      const newTempTodo: Todo = { ...emptyTodo, title: todoTitle.trim() };

      setTempTodo(newTempTodo);
      setProcessingTodos([newTempTodo.id]);

      try {
        const todo = await uploadTodo({
          ...emptyTodo,
          title: todoTitle.trim(),
        });

        setTodos(currentTodos => [...currentTodos, todo]);
        setTodoTitle('');
      } catch {
        setErrorMessage(ErrorType.ADD_TODO);
      } finally {
        setIsLoading(false);
        setTempTodo(null);
        setProcessingTodos([]);
        focusInputField();
      }
    },
    [todoTitle],
  );

  const onDeleteTodo = useCallback((id: number) => {
    deleteTodo(id)
      .then(() => {
        setTodos(currentTodos => currentTodos.filter(t => t.id !== id));
      })
      .catch(() => {
        setErrorMessage(ErrorType.DELETE_TODO);
      })
      .finally(() => {
        setProcessingTodos(prev => prev.filter(prevItem => prevItem !== id));
        focusInputField();
      });
  }, []);

  const removeTodo = useCallback(
    (id: number) => {
      setErrorMessage('');
      setProcessingTodos((prev: number[]) => [...prev, id]);

      onDeleteTodo(id);
    },
    [onDeleteTodo],
  );

  const removeTodos = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const deletePromises = filteringTodosByCompletedStatus.map(todo => {
      removeTodo(todo.id);
    });

    await Promise.allSettled(deletePromises);
    setIsLoading(false);
  }, [filteringTodosByCompletedStatus, removeTodo]);

  const onUpdateTodo = useCallback(async (id: number, data: UpdateTodoData) => {
    return updateTodo(id, data)
      .then(todo => {
        setTodos(currentTodos => {
          const newTodos = [...currentTodos];
          const index = newTodos.findIndex(t => t.id === todo.id);

          newTodos.splice(index, 1, todo);

          return newTodos;
        });
        setEditingTodoId(null);
      })
      .catch(() => {
        setErrorMessage(ErrorType.UPDATE_TODO);
        if (data.hasOwnProperty('title')) {
          setEditingTodoId(id);
          throw new Error();
        }
      })
      .finally(() => {
        setProcessingTodos(prev => prev.filter(prevItem => prevItem !== id));
        if (!data.hasOwnProperty('title')) {
          focusInputField();
        }
      });
  }, []);

  const toggleTodoStatus = useCallback(
    (id: number, data: UpdateTodoData) => {
      setErrorMessage('');
      setProcessingTodos(prev => [...prev, id]);
      onUpdateTodo(id, data);
    },
    [onUpdateTodo],
  );

  const toggleAll = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    let todosForChange: Todo[] = [];

    if (filteringTodosByCompletedStatus.length !== todos.length) {
      todosForChange = [...filteringTodosByActiveStatus];
    } else if (
      filteringTodosByCompletedStatus.length === todos.length ||
      filteringTodosByActiveStatus.length === todos.length
    ) {
      todosForChange = [...todos];
    }

    const togglePromises = todosForChange.map(todo => {
      toggleTodoStatus(todo.id, { completed: !todo.completed });
    });

    await Promise.allSettled(togglePromises);
    setIsLoading(false);
  }, [
    filteringTodosByActiveStatus,
    filteringTodosByCompletedStatus.length,
    todos,
    toggleTodoStatus,
  ]);

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <Header
          todos={todos}
          value={todoTitle}
          addTodo={addTodo}
          onChange={changeTodoTitleHandler}
          inputRef={inputRef}
          isLoading={isLoading}
          completedTodosCount={filteringTodosByCompletedStatus.length}
          toggleAll={toggleAll}
        />
        <TodoList
          preparedTodos={filteredTodos}
          processingTodos={processingTodos}
          tempTodo={tempTodo}
          removeTodo={removeTodo}
          toggleTodoStatus={toggleTodoStatus}
          errorMessage={errorMessage}
          editingTodoId={editingTodoId}
          selectedEditTodoId={selectedEditTodoId}
          onUpdateTodo={onUpdateTodo}
          updateProcessingTodos={updateProcessingTodos}
          removeProcessingTodos={removeProcessingTodos}
        />

        <Footer
          todos={todos}
          selectedStatus={selectedTodoStatus}
          onStatusChange={handleStatusChange}
          filteringTodosByActiveStatus={filteringTodosByActiveStatus.length}
          filteringTodosByCompletedStatus={
            filteringTodosByCompletedStatus.length
          }
          removeTodos={removeTodos}
        />
      </div>

      <ErrorNotification
        errorMessage={errorMessage}
        closeErrorHandler={closeErrorHandler}
      />
    </div>
  );
};

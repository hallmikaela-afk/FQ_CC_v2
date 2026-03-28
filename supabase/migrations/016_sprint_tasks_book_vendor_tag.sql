-- Add 'book_vendor' as an allowed tag value for sprint_tasks
alter table sprint_tasks drop constraint if exists sprint_tasks_tag_check;
alter table sprint_tasks add constraint sprint_tasks_tag_check
  check (tag in ('action', 'decision', 'creative', 'ops', 'marketing', 'build', 'client', 'check', 'research', 'book_vendor', 'other'));

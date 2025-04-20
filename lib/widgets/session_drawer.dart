import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/session.dart';
import '../providers/session_provider.dart';

class SessionDrawer extends StatelessWidget {
  const SessionDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: Consumer<SessionProvider>(
        builder: (context, sessProv, child) {
          return Column(
            children: [
              DrawerHeader(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                ),
                child: Align(
                  alignment: Alignment.bottomLeft,
                  child: Text(
                    'Sessions',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onPrimary,
                      fontSize: 24,
                    ),
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  itemCount: sessProv.sessions.length,
                  itemBuilder: (context, index) {
                    final session = sessProv.sessions[index];
                    final isActive = session.id == sessProv.activeSessionId;
                    return ListTile(
                      title: Text(
                        session.name,
                        style:
                            isActive
                                ? const TextStyle(fontWeight: FontWeight.bold)
                                : null,
                      ),
                      onTap: () {
                        sessProv.switchSession(session.id);
                        Navigator.pop(context);
                      },
                      onLongPress:
                          () => _showRenameSessionDialog(
                            context,
                            sessProv,
                            session,
                          ),
                      trailing:
                          sessProv.sessions.length > 1
                              ? IconButton(
                                icon: const Icon(Icons.delete),
                                onPressed: () {
                                  sessProv.deleteSession(session.id);
                                  if (Navigator.canPop(context)) {
                                    Navigator.pop(context);
                                  }
                                },
                              )
                              : null,
                    );
                  },
                ),
              ),
              ListTile(
                leading: const Icon(Icons.add),
                title: const Text('New Session'),
                onTap: () {
                  _showCreateSessionDialog(
                    context,
                    Provider.of<SessionProvider>(context, listen: false),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }

  void _showCreateSessionDialog(
    BuildContext context,
    SessionProvider provider,
  ) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder:
          (_) => AlertDialog(
            title: const Text('New Session'),
            content: TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'Session name'),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () {
                  final name = controller.text.trim();
                  if (name.isNotEmpty) {
                    provider.createSession(name);
                  }
                  Navigator.pop(context);
                },
                child: const Text('Create'),
              ),
            ],
          ),
    );
  }

  void _showRenameSessionDialog(
    BuildContext context,
    SessionProvider provider,
    Session session,
  ) {
    final controller = TextEditingController(text: session.name);
    showDialog(
      context: context,
      builder:
          (_) => AlertDialog(
            title: const Text('Rename Session'),
            content: TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'New name'),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () {
                  final newName = controller.text.trim();
                  if (newName.isNotEmpty) {
                    provider.renameSession(session.id, newName);
                  }
                  Navigator.pop(context);
                },
                child: const Text('Rename'),
              ),
            ],
          ),
    );
  }
}

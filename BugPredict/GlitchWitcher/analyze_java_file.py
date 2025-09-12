#!/usr/bin/env python3
"""
Java file analysis script for semantic metrics extraction
"""

import sys
import os
import javalang
import subprocess
from collections import defaultdict
import csv
import re

def get_cyclomatic_complexity(method):
    complexity = 1
    for _, node in method.filter(javalang.tree.IfStatement):
        complexity += 1
    for _, node in method.filter(javalang.tree.ForStatement):
        complexity += 1
    for _, node in method.filter(javalang.tree.WhileStatement):
        complexity += 1
    for _, node in method.filter(javalang.tree.DoStatement):
        complexity += 1
    for _, node in method.filter(javalang.tree.SwitchStatement):
        complexity += len([s for s in node.cases if s.statements])
    for _, node in method.filter(javalang.tree.CatchClause):
        complexity += 1
    return complexity

def get_bug_count(file_path, repo_dir):
    try:
        relative_path = os.path.relpath(file_path, repo_dir)
        result = subprocess.run(
            ['git', '-C', repo_dir, 'log', '--follow', '--', relative_path],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return 0
        bug_count = len([line for line in result.stdout.splitlines() if re.search(r'\b(fix|hotfix|bugfix|chore|refactor|test-fix)\b', line, re.IGNORECASE)])
        return bug_count
    except:
        return 0

def analyze_file(file_path, project_name, version, repo_dir):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            code = f.read()
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return None
    
    try:
        tree = javalang.parse.parse(code)
    except Exception as e:
        print(f"Error parsing Java code in {file_path}: {e}")
        return None

    try:
        # Count classes found
        classes = list(tree.filter(javalang.tree.ClassDeclaration))
        if not classes:
            print(f"No classes found in {file_path}")
            return None
        
        print(f"Found {len(classes)} class(es) in {file_path}")
        
        for _, class_node in classes:
            fully_qualified_name = f"{tree.package.name}.{class_node.name}" if tree.package else class_node.name

            metrics = {
                'project_name': project_name,
                'version': version,
                'class_name': fully_qualified_name,
                'wmc': 0,
                'rfc': 0,
                'loc': len(code.splitlines()),
                'max_cc': 0,
                'avg_cc': 0,
                'cbo': 0,
                'ca': 0,
                'ce': 0,
                'ic': 0,
                'cbm': 0,
                'lcom': 0,
                'lcom3': 0,
                'dit': 0,
                'noc': 0,
                'mfa': 0,
                'npm': 0,
                'dam': 0,
                'moa': 0,
                'cam': 0,
                'amc': 0,
                'bug': get_bug_count(file_path, repo_dir)
            }

            # Methods and complexity
            methods = class_node.methods
            metrics['wmc'] = len(methods)
            cc_values = []
            method_names = set()
            for method in methods:
                cc = get_cyclomatic_complexity(method)
                cc_values.append(cc)
                method_names.add(method.name)
                if isinstance(method, javalang.tree.MethodDeclaration):
                    metrics['npm'] += 1 if method.modifiers and 'public' in method.modifiers else 0

            metrics['max_cc'] = max(cc_values) if cc_values else 0
            metrics['avg_cc'] = sum(cc_values) / len(cc_values) if cc_values else 0
            metrics['amc'] = metrics['loc'] / metrics['wmc'] if metrics['wmc'] > 0 else 0

            # Inheritance metrics
            metrics['dit'] = 1 if class_node.extends else 0
            metrics['ic'] = metrics['dit']

            # Coupling and cohesion
            fields = [f for f in class_node.fields if isinstance(f, javalang.tree.FieldDeclaration)]
            metrics['moa'] = sum(1 for f in fields if f.type and isinstance(f.type, javalang.tree.ReferenceType))
            total_fields = len(fields)
            private_fields = sum(1 for f in fields if f.modifiers and ('private' in f.modifiers or 'protected' in f.modifiers))
            metrics['dam'] = private_fields / total_fields if total_fields > 0 else 0

            # LCOM calculation
            field_usage = defaultdict(set)
            for method in methods:
                for _, node in method.filter(javalang.tree.MemberReference):
                    if node.qualifier in [f.declarators[0].name for f in fields]:
                        field_usage[method.name].add(node.qualifier)
            lcom = 0
            for i, m1 in enumerate(methods):
                for m2 in methods[i+1:]:
                    if not (field_usage[m1.name] & field_usage[m2.name]):
                        lcom += 1
            metrics['lcom'] = lcom
            metrics['lcom3'] = 2 * lcom / (len(methods) * (len(methods) - 1)) if len(methods) > 1 else 0

            # RFC and CBO
            called_methods = set()
            for method in methods:
                for _, node in method.filter(javalang.tree.MethodInvocation):
                    called_methods.add(node.member)
            metrics['rfc'] = len(methods) + len(called_methods)
            metrics['cbo'] = len(called_methods)

            # CBM: Count intra-class method calls
            intra_class_calls = 0
            for method in methods:
                for _, node in method.filter(javalang.tree.MethodInvocation):
                    if node.member in method_names:
                        intra_class_calls += 1
            metrics['cbm'] = intra_class_calls

            # CAM: Cohesion among methods (simplified)
            metrics['cam'] = 0.5  # Default value

            # MFA: Measure of functional abstraction
            metrics['mfa'] = 0.0  # Default value

            print(f"Successfully analyzed class: {fully_qualified_name}")
            return metrics
    except Exception as e:
        print(f"Error analyzing class in {file_path}: {e}")
        return None
    
    return None

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python analyze_java_file.py <file_path> <project_name> <version> <repo_dir>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    project_name = sys.argv[2]
    version = sys.argv[3]
    repo_dir = sys.argv[4]
    
    try:
        metrics = analyze_file(file_path, project_name, version, repo_dir)
        if metrics:
            # Write to CSV only if we have actual data
            with open('temp_metrics.csv', 'w', newline='') as f:
                fieldnames = ['project_name', 'version', 'class_name', 'wmc', 'rfc', 'loc', 'max_cc', 'avg_cc',
                              'cbo', 'ca', 'ce', 'ic', 'cbm', 'lcom', 'lcom3', 'dit', 'noc', 'mfa',
                              'npm', 'dam', 'moa', 'cam', 'amc', 'bug']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()  # Write the header first
                writer.writerow(metrics)
            print("Metrics extracted successfully")
            sys.exit(0)
        else:
            print("No classes found in file or parsing failed")
            sys.exit(1)
    except Exception as e:
        print(f"Unexpected error processing {file_path}: {e}")
        sys.exit(1) 
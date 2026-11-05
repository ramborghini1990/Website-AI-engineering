"use client";

import { Copy } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/toaster";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";

import { ThemeSwitch } from "./theme-switch";

// Dev-only page: copy is English and hard-coded on purpose (the production
// components take every string as a prop / from i18n messages).
const CLOSE = "Close";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="grid gap-6 border-t border-border-subtle pt-8"
    >
      <h2 id={id} className="text-2xl text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ children }: { children: ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
}

function FieldsDemo() {
  const nameId = useId();
  const nameHelpId = useId();
  const emailId = useId();
  const emailErrorId = useId();
  const messageId = useId();
  const serviceId = useId();

  return (
    <div className="grid max-w-md gap-6">
      <Field>
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          name="name"
          autoComplete="name"
          aria-describedby={nameHelpId}
          placeholder="Ada Lovelace"
        />
        <p id={nameHelpId} className="text-sm text-text-muted">
          As you want it to appear in our reply.
        </p>
      </Field>

      <Field>
        <Label htmlFor={emailId}>Email (invalid example)</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue="not-an-email"
          aria-invalid="true"
          aria-describedby={emailErrorId}
        />
        <p id={emailErrorId} className="text-sm text-danger">
          Enter an address like name@company.eu
        </p>
      </Field>

      <Field>
        <Label htmlFor={messageId}>Message</Label>
        <Textarea
          id={messageId}
          name="message"
          placeholder="What would you like to automate?"
        />
      </Field>

      <Field>
        <Label htmlFor={serviceId}>Service</Label>
        <Select name="service">
          <SelectTrigger id={serviceId}>
            <SelectValue placeholder="Choose a service" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Practice areas</SelectLabel>
              <SelectItem value="agents">AI agents</SelectItem>
              <SelectItem value="automation">Workflow automation</SelectItem>
              <SelectItem value="web">Full-stack web apps</SelectItem>
              <SelectItem value="documents" disabled>
                Document intelligence (soon)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <Label htmlFor={`${nameId}-disabled`}>Disabled field</Label>
        <Input id={`${nameId}-disabled`} disabled defaultValue="Read only" />
      </Field>
    </div>
  );
}

function CheckboxRow({
  label,
  ...props
}: { label: string } & ComponentProps<typeof Checkbox>) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center gap-3">
      <Checkbox id={id} {...props} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

function CheckboxGroupDemo() {
  const [items, setItems] = useState({ one: true, two: false });
  const all = items.one && items.two;
  const some = items.one || items.two;
  return (
    <div className="grid gap-1">
      <CheckboxRow
        label="Select all"
        checked={all ? true : some ? "indeterminate" : false}
        onCheckedChange={(next) => {
          setItems({ one: next === true, two: next === true });
        }}
      />
      <div className="grid gap-1 pl-9">
        <CheckboxRow
          label="Agents"
          checked={items.one}
          onCheckedChange={(next) => {
            setItems((prev) => ({ ...prev, one: next === true }));
          }}
        />
        <CheckboxRow
          label="Automation"
          checked={items.two}
          onCheckedChange={(next) => {
            setItems((prev) => ({ ...prev, two: next === true }));
          }}
        />
      </div>
    </div>
  );
}

function SheetDemo({ side }: { side: "right" | "left" | "top" | "bottom" }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">Open {side} sheet</Button>
      </SheetTrigger>
      <SheetContent side={side} closeLabel={CLOSE}>
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            A sheet is a dialog docked to the {side} edge.
          </SheetDescription>
        </SheetHeader>
        <CheckboxRow label="Only live demos" />
        <SheetFooter>
          <SheetClose asChild>
            <Button>Apply</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function UiGallery() {
  const dialogFieldId = useId();

  return (
    <TooltipProvider>
      <main className="mx-auto grid w-full max-w-page gap-12 px-gutter py-16">
        <header className="grid gap-4">
          <h1 className="text-4xl text-text">UI primitives</h1>
          <p className="max-w-prose text-lg text-text-secondary">
            Development-only gallery. It returns 404 in production builds. Use
            it to check every component and state in both themes, with mouse and
            keyboard.
          </p>
          <ThemeSwitch />
        </header>

        <Section title="Button">
          <div className="flex flex-wrap items-center gap-4">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
            <Button asChild variant="secondary">
              <a href="#fields">Link as button</a>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="secondary" aria-label="Copy link">
                  <Copy aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy link to this page</TooltipContent>
            </Tooltip>
          </div>
        </Section>

        <Section title="Input, Textarea, Select">
          <div id="fields">
            <FieldsDemo />
          </div>
        </Section>

        <Section title="Checkbox">
          <div className="grid gap-1">
            <CheckboxRow label="Unchecked" />
            <CheckboxRow label="Checked" defaultChecked />
            <CheckboxRow label="Disabled" disabled />
            <CheckboxRow label="Invalid" aria-invalid="true" />
            <CheckboxGroupDemo />
          </div>
        </Section>

        <Section title="Dialog">
          <div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>Open dialog</Button>
              </DialogTrigger>
              <DialogContent closeLabel={CLOSE}>
                <DialogHeader>
                  <DialogTitle>Request a call</DialogTitle>
                  <DialogDescription>
                    Focus stays inside this dialog. Escape closes it and focus
                    returns to the button that opened it.
                  </DialogDescription>
                </DialogHeader>
                <Field>
                  <Label htmlFor={dialogFieldId}>Company</Label>
                  <Input id={dialogFieldId} autoComplete="organization" />
                </Field>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button>Send</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Section>

        <Section title="Sheet">
          <div className="flex flex-wrap gap-4">
            <SheetDemo side="right" />
            <SheetDemo side="left" />
            <SheetDemo side="top" />
            <SheetDemo side="bottom" />
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="agents" className="max-w-xl">
            <TabsList aria-label="Practice areas">
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="automation">Automation</TabsTrigger>
              <TabsTrigger value="web">Web apps</TabsTrigger>
            </TabsList>
            <TabsContent value="agents">
              <p className="text-base text-text-secondary">
                Agents that read, decide and act inside your tools.
              </p>
            </TabsContent>
            <TabsContent value="automation">
              <p className="text-base text-text-secondary">
                Workflows that remove repeated manual steps.
              </p>
            </TabsContent>
            <TabsContent value="web">
              <p className="text-base text-text-secondary">
                Production web applications, built to last.
              </p>
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Tooltip">
          <div className="flex flex-wrap items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">Hover or focus me</Button>
              </TooltipTrigger>
              <TooltipContent>
                Extra context, never the only source
              </TooltipContent>
            </Tooltip>
          </div>
        </Section>

        <Section title="Toast">
          <div className="flex flex-wrap gap-4">
            <Button
              variant="secondary"
              onClick={() => {
                toast({
                  title: "Saved",
                  description: "Your draft was stored on this device.",
                });
              }}
            >
              Default toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                toast({
                  variant: "success",
                  title: "Message sent",
                  description: "We will reply within one working day.",
                });
              }}
            >
              Success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                toast({
                  variant: "danger",
                  title: "Could not send",
                  description: "Check your connection and try again.",
                  action: {
                    label: "Retry",
                    altText: "Retry sending the message",
                    onClick: () => undefined,
                  },
                });
              }}
            >
              Error toast (stays)
            </Button>
          </div>
        </Section>
      </main>
      <Toaster viewportLabel="Notifications ({hotkey})" closeLabel={CLOSE} />
    </TooltipProvider>
  );
}
